// Progetto di sistema "🏖️ FERIE": esiste una sola istanza globale, mostrata di
// default come prima riga sotto ogni persona. Non è modificabile (no rename,
// delete o riordino) ma accetta schedule come qualsiasi altro progetto.
export const FERIE_PROJECT_ID = "ferie";
export const FERIE_PROJECT_NAME = "🏖️ FERIE";

export function isFerieProject(id: string | null | undefined): boolean {
  return id === FERIE_PROJECT_ID;
}
