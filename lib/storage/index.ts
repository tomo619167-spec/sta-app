import { IndexedDBStudyRepository } from "./indexed-db";
import type { StudyRepository } from "./repository";
// Replace the adapter here when adding authenticated cloud storage.
export const studyRepository: StudyRepository = new IndexedDBStudyRepository();
