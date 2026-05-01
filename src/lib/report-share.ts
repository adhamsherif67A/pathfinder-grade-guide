import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";

export type ReportShareCourse = {
  course_code: string | null;
  course_name?: string | null;
  letter_grade: string;
  credit_hours: number;
};

export type ReportShareStudent = {
  full_name: string;
  registration_number: string;
};

export type ReportSharePayloadV1 = {
  v: 1;
  generated_at: string;
  student?: ReportShareStudent;
  courses: ReportShareCourse[];
};

export function encodeReportSharePayload(payload: ReportSharePayloadV1): string {
  return compressToEncodedURIComponent(JSON.stringify(payload));
}

export function decodeReportSharePayload(hash: string): ReportSharePayloadV1 | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return null;

  const json = decompressFromEncodedURIComponent(raw);
  if (!json) return null;

  try {
    const parsed = JSON.parse(json) as ReportSharePayloadV1;
    if (!parsed || parsed.v !== 1 || !Array.isArray(parsed.courses)) return null;
    return parsed;
  } catch {
    return null;
  }
}
