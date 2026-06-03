import type { NamedItem } from "./student";

export type StudentGroup = NamedItem & {
  specialityId: number;
};
