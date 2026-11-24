const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DB_DIR = path.resolve(__dirname, "../data/json-db");
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

function generateId() {
  return crypto.randomBytes(12).toString("hex");
}

function loadCollection(name) {
  const filePath = path.join(DB_DIR, `${name.toLowerCase()}.json`);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) || [];
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err.message);
    return [];
  }
}

function saveCollection(name, data) {
  const filePath = path.join(DB_DIR, `${name.toLowerCase()}.json`);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err.message);
  }
}

function matchCondition(val, condition) {
  if (condition instanceof RegExp) {
    return condition.test(String(val || ""));
  }
  if (condition && typeof condition === "object" && !(condition instanceof Date)) {
    if ("$in" in condition && Array.isArray(condition.$in)) {
      return condition.$in.includes(val);
    }
    if ("$nin" in condition && Array.isArray(condition.$nin)) {
      return !condition.$nin.includes(val);
    }
    if ("$exists" in condition) {
      const exists = val !== undefined && val !== null;
      return condition.$exists ? exists : !exists;
    }
    if ("$gt" in condition) return val > condition.$gt;
    if ("$gte" in condition) return val >= condition.$gte;
    if ("$lt" in condition) return val < condition.$lt;
    if ("$lte" in condition) return val <= condition.$lte;
    if ("$ne" in condition) return val !== condition.$ne;
  }
  return val === condition;
}

function matchDoc(doc, query) {
  if (!query || Object.keys(query).length === 0) return true;

  if (Array.isArray(query.$or)) {
    const orMatches = query.$or.some((subQuery) => matchDoc(doc, subQuery));
    if (!orMatches) return false;
  }

  if (Array.isArray(query.$and)) {
    const andMatches = query.$and.every((subQuery) => matchDoc(doc, subQuery));
    if (!andMatches) return false;
  }

  for (const [key, expected] of Object.entries(query)) {
    if (key === "$or" || key === "$and") continue;
    const actual = doc[key];
    if (!matchCondition(actual, expected)) {
      return false;
    }
  }

  return true;
}

class QueryChain {
  constructor(modelName, filter = {}, isSingle = false) {
    this.modelName = modelName;
    this.filter = filter;
    this.isSingle = isSingle;
    this._sort = null;
    this._limit = null;
    this._skip = null;
    this._lean = false;
  }

  sort(criteria) {
    this._sort = criteria;
    return this;
  }

  limit(n) {
    this._limit = Number(n);
    return this;
  }

  skip(n) {
    this._skip = Number(n);
    return this;
  }

  select() {
    return this;
  }

  lean() {
    this._lean = true;
    return this;
  }

  _execute() {
    const all = loadCollection(this.modelName);
    let matched = all.filter((doc) => matchDoc(doc, this.filter));

    if (this._sort) {
      const sortKeys = Object.entries(this._sort);
      matched.sort((a, b) => {
        for (const [k, dir] of sortKeys) {
          const aVal = a[k] instanceof Date ? a[k].getTime() : a[k];
          const bVal = b[k] instanceof Date ? b[k].getTime() : b[k];
          if (aVal < bVal) return dir === -1 ? 1 : -1;
          if (aVal > bVal) return dir === -1 ? -1 : 1;
        }
        return 0;
      });
    }

    if (this._skip) {
      matched = matched.slice(this._skip);
    }
    if (this._limit) {
      matched = matched.slice(0, this._limit);
    }

    if (this.isSingle) {
      const item = matched[0] || null;
      return item ? wrapDocument(this.modelName, item) : null;
    }

    return matched.map((item) => wrapDocument(this.modelName, item));
  }

  then(onFulfilled, onRejected) {
    try {
      const result = this._execute();
      return Promise.resolve(result).then(onFulfilled, onRejected);
    } catch (err) {
      return Promise.reject(err).then(onFulfilled, onRejected);
    }
  }

  catch(onRejected) {
    return this.then(null, onRejected);
  }
}

function wrapDocument(modelName, data) {
  if (!data) return null;
  const doc = { ...data };

  Object.defineProperty(doc, "save", {
    enumerable: false,
    value: async function () {
      doc.updatedAt = new Date().toISOString();
      const all = loadCollection(modelName);
      const idx = all.findIndex((item) => item._id === doc._id);
      if (idx !== -1) {
        all[idx] = { ...doc };
      } else {
        all.push({ ...doc });
      }
      saveCollection(modelName, all);
      return doc;
    },
  });

  Object.defineProperty(doc, "toObject", {
    enumerable: false,
    value: function () {
      return { ...doc };
    },
  });

  return doc;
}

class JsonModel {
  constructor(modelName, schema) {
    this.modelName = modelName;
    this.schema = schema;

    // Model constructor: new Model(data)
    const ModelConstructor = function (data = {}) {
      const now = new Date().toISOString();
      const instance = {
        _id: generateId(),
        createdAt: now,
        updatedAt: now,
        ...data,
      };
      return wrapDocument(modelName, instance);
    };

    ModelConstructor.modelName = modelName;
    ModelConstructor.schema = schema;

    ModelConstructor.find = (query = {}) => {
      return new QueryChain(modelName, query, false);
    };

    ModelConstructor.findOne = (query = {}) => {
      return new QueryChain(modelName, query, true);
    };

    ModelConstructor.findById = (id) => {
      return new QueryChain(modelName, { _id: String(id) }, true);
    };

    ModelConstructor.create = async (data = {}) => {
      const all = loadCollection(modelName);
      const now = new Date().toISOString();
      const doc = {
        _id: generateId(),
        createdAt: now,
        updatedAt: now,
        ...data,
      };
      all.push(doc);
      saveCollection(modelName, all);
      return wrapDocument(modelName, doc);
    };

    ModelConstructor.findByIdAndUpdate = async (id, update = {}, options = {}) => {
      const all = loadCollection(modelName);
      const idx = all.findIndex((item) => String(item._id) === String(id));
      if (idx === -1) return null;

      const current = all[idx];
      const payload = update.$set ? { ...update.$set } : { ...update };
      delete payload.$set;

      const updated = {
        ...current,
        ...payload,
        updatedAt: new Date().toISOString(),
      };
      all[idx] = updated;
      saveCollection(modelName, all);
      return wrapDocument(modelName, updated);
    };

    ModelConstructor.findOneAndUpdate = async (query = {}, update = {}, options = {}) => {
      const all = loadCollection(modelName);
      const idx = all.findIndex((item) => matchDoc(item, query));

      if (idx === -1) {
        if (options.upsert) {
          const now = new Date().toISOString();
          const doc = {
            _id: generateId(),
            createdAt: now,
            updatedAt: now,
            ...query,
            ...(update.$set || update),
            ...(update.$setOnInsert || {}),
          };
          delete doc.$set;
          delete doc.$setOnInsert;
          all.push(doc);
          saveCollection(modelName, all);
          return wrapDocument(modelName, doc);
        }
        return null;
      }

      const current = all[idx];
      const payload = update.$set ? { ...update.$set } : { ...update };
      delete payload.$set;

      const updated = {
        ...current,
        ...payload,
        updatedAt: new Date().toISOString(),
      };
      all[idx] = updated;
      saveCollection(modelName, all);
      return wrapDocument(modelName, updated);
    };

    ModelConstructor.findByIdAndDelete = async (id) => {
      const all = loadCollection(modelName);
      const filtered = all.filter((item) => String(item._id) !== String(id));
      saveCollection(modelName, filtered);
      return { deleted: true };
    };

    ModelConstructor.findOneAndDelete = async (query = {}) => {
      const all = loadCollection(modelName);
      const idx = all.findIndex((item) => matchDoc(item, query));
      if (idx !== -1) {
        all.splice(idx, 1);
        saveCollection(modelName, all);
      }
      return { deleted: true };
    };

    ModelConstructor.deleteOne = async (query = {}) => {
      const all = loadCollection(modelName);
      const idx = all.findIndex((item) => matchDoc(item, query));
      if (idx !== -1) {
        all.splice(idx, 1);
        saveCollection(modelName, all);
        return { deletedCount: 1 };
      }
      return { deletedCount: 0 };
    };

    ModelConstructor.deleteMany = async (query = {}) => {
      const all = loadCollection(modelName);
      const remaining = all.filter((item) => !matchDoc(item, query));
      const deletedCount = all.length - remaining.length;
      saveCollection(modelName, remaining);
      return { deletedCount };
    };

    ModelConstructor.countDocuments = async (query = {}) => {
      const all = loadCollection(modelName);
      return all.filter((item) => matchDoc(item, query)).length;
    };

    ModelConstructor.aggregate = async (pipeline = []) => {
      let data = loadCollection(modelName);
      for (const stage of pipeline) {
        if (stage.$match) {
          data = data.filter((item) => matchDoc(item, stage.$match));
        }
        if (stage.$group) {
          const groupField = stage.$group._id.replace(/^\$/, "");
          const grouped = {};
          for (const item of data) {
            const key = item[groupField];
            if (!grouped[key]) grouped[key] = { _id: key, count: 0 };
            grouped[key].count += 1;
          }
          data = Object.values(grouped);
        }
      }
      return data;
    };

    ModelConstructor.bulkWrite = async (operations = []) => {
      for (const op of operations) {
        if (op.updateOne) {
          await ModelConstructor.findOneAndUpdate(op.updateOne.filter, op.updateOne.update, {
            upsert: op.updateOne.upsert,
          });
        }
      }
      return { ok: 1 };
    };

    return ModelConstructor;
  }
}

class Schema {
  constructor(definition, options = {}) {
    this.definition = definition;
    this.options = options;
  }
  index() {
    return this;
  }
}

Schema.Types = {
  ObjectId: String,
  String,
  Number,
  Boolean,
  Date,
  Array,
};

const modelsRegistry = {};

const jsonMongoose = {
  Schema,
  model(name, schema) {
    if (!modelsRegistry[name]) {
      modelsRegistry[name] = new JsonModel(name, schema);
    }
    return modelsRegistry[name];
  },
  connection: {
    readyState: 1, // 1 = connected
    collection(name) {
      return {
        findOne: async (query) => {
          const all = loadCollection(name);
          return all.find((item) => matchDoc(item, query)) || null;
        },
        findOneAndUpdate: async (query, update, opts) => {
          const all = loadCollection(name);
          let item = all.find((i) => matchDoc(i, query));
          if (!item && opts?.upsert) {
            item = { _id: query._id || generateId(), ...update.$set };
            all.push(item);
          } else if (item && update.$set) {
            Object.assign(item, update.$set);
          }
          saveCollection(name, all);
          return item;
        },
        updateOne: async (query, update) => {
          const all = loadCollection(name);
          const item = all.find((i) => matchDoc(i, query));
          if (item && update.$set) Object.assign(item, update.$set);
          saveCollection(name, all);
          return { modifiedCount: 1 };
        },
        deleteMany: async (query) => {
          const all = loadCollection(name);
          const remaining = all.filter((i) => !matchDoc(i, query));
          saveCollection(name, remaining);
          return { deletedCount: all.length - remaining.length };
        },
      };
    },
    on() {},
    once() {},
  },
  async connect() {
    console.log("⚡ [JSON-DB Storage Activated] Storing application data directly in JSON files at:", DB_DIR);
    return jsonMongoose;
  },
  async disconnect() {
    return true;
  },
};

module.exports = jsonMongoose;
