import type { StudyRecord, Theme, ThemeInput } from "../model";
/** UI-facing contract. A future Supabase adapter implements this interface. */
export interface StudyRepository {
  listThemes(): Promise<Theme[]>;
  getTheme(id: string): Promise<Theme | undefined>;
  createTheme(input: ThemeInput): Promise<Theme>;
  updateTheme(id: string, input: ThemeInput): Promise<Theme>;
  deleteTheme(id: string): Promise<void>;
  listRecords(themeId?: string): Promise<StudyRecord[]>;
  addRecord(themeId: string, note: string): Promise<StudyRecord>;
}
