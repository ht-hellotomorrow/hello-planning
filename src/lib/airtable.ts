import Airtable from "airtable";

export type AirtableProjectFields = {
  Code?: string;
  "Project Name"?: string;
  Status?: string;
  Internal?: boolean;
};

export type AirtableProjectRecord = {
  id: string;
  fields: AirtableProjectFields;
};

function getBase() {
  const apiKey = process.env.AIRTABLE_PAT;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!apiKey || !baseId) {
    throw new Error(
      "Missing Airtable env vars (AIRTABLE_PAT, AIRTABLE_BASE_ID)",
    );
  }
  return new Airtable({ apiKey }).base(baseId);
}

export async function fetchAllProjects(): Promise<AirtableProjectRecord[]> {
  const tableId = process.env.AIRTABLE_PROJECTS_TABLE_ID;
  if (!tableId) throw new Error("Missing AIRTABLE_PROJECTS_TABLE_ID");

  const base = getBase();
  const records = await base(tableId)
    .select({
      fields: ["Code", "Project Name", "Status", "Internal"],
      pageSize: 100,
    })
    .all();

  return records.map((r) => ({
    id: r.id,
    fields: r.fields as AirtableProjectFields,
  }));
}
