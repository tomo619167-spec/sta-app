import {
  Sigma,
  Languages,
  Globe2,
  Atom,
  FlaskConical,
  Leaf,
  ChartNoAxesCombined,
  Code2,
  BookOpen,
} from "lucide-react";
import { inferSubjectIcon, type SubjectIconKey } from "@/lib/subject-icons";
const icons = {
  math: Sigma,
  language: Languages,
  history: Globe2,
  physics: Atom,
  chemistry: FlaskConical,
  biology: Leaf,
  economics: ChartNoAxesCombined,
  code: Code2,
  general: BookOpen,
};
export function SubjectIcon({
  name = "",
  icon,
  className = "subject-icon",
}: {
  name?: string;
  icon?: SubjectIconKey;
  className?: string;
}) {
  const key = icon ?? inferSubjectIcon(name);
  const Icon = icons[key] ?? BookOpen;
  return (
    <Icon className={className} aria-hidden="true" data-subject-icon={key} />
  );
}
