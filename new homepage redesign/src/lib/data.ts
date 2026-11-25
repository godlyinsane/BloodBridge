export type Facility = { name: string; type: "Government" | "Hospital" | "Blood Bank"; city: string; phone: string };

export const FACILITIES: Facility[] = [
  { name: "District Hospital Blood Bank", type: "Government", city: "Sehore", phone: "07562226000" },
  { name: "Hamidia Hospital Blood Bank", type: "Government", city: "Bhopal", phone: "07554050450" },
  { name: "AIIMS Bhopal Blood Centre", type: "Hospital", city: "Bhopal", phone: "07552672355" },
  { name: "Red Cross Blood Bank", type: "Blood Bank", city: "Bhopal", phone: "07552551010" },
  { name: "Civil Hospital Ashta", type: "Government", city: "Ashta", phone: "07560242001" },
  { name: "District Hospital Raisen", type: "Government", city: "Raisen", phone: "07482222220" },
  { name: "District Hospital Hoshangabad", type: "Government", city: "Hoshangabad", phone: "07574252444" },
  { name: "Bansal Hospital Blood Bank", type: "Hospital", city: "Bhopal", phone: "07554086000" },
  { name: "Chirayu Medical College Blood Bank", type: "Hospital", city: "Bhopal", phone: "07552709101" },
];

export const mapsUrl = (q: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
