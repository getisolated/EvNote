export const SAMPLE_NOTES: { title: string; content: string }[] = [
  {
    title: 'Markdown basique',
    content: `# Titre principal H1

## Sous-titre H2

### Section H3

#### Sous-section H4

Ceci est un paragraphe normal avec du **texte en gras**, du *texte en italique*, et du ~~texte barré~~. On peut aussi combiner ***gras et italique***.

Voici un [lien vers Google](https://google.com) et du \`code inline\` dans une phrase.

---

> Ceci est une citation blockquote.
> Elle peut s'étendre sur plusieurs lignes.

Liste non ordonnée :
- Premier élément
- Deuxième élément
- Troisième élément

Liste ordonnée :
1. Étape une
2. Étape deux
3. Étape trois`,
  },
  {
    title: 'Code Blocks Test',
    content: `# Code Blocks Test

Voici du TypeScript :

\`\`\`typescript
interface User {
  id: number;
  name: string;
  email?: string;
}

const getUser = async (id: number): Promise<User | null> => {
  if (id <= 0) return null;
  const response = await fetch(\\\`/api/users/\\\${id}\\\`);
  return response.json();
};

export class UserService {
  private users: Map<number, User> = new Map();

  findById(id: number): User | undefined {
    return this.users.get(id);
  }
}
\`\`\`

Du Python :

\`\`\`python
def fibonacci(n: int) -> list[int]:
    """Generate fibonacci sequence up to n terms."""
    if n <= 0:
        return []
    sequence = [0, 1]
    for i in range(2, n):
        sequence.append(sequence[-1] + sequence[-2])
    return sequence[:n]

# Usage
result = fibonacci(10)
print(f"Fibonacci: {result}")  # [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]
\`\`\`

Du SQL :

\`\`\`sql
SELECT u.name, COUNT(o.id) AS total_orders
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE u.created_at >= '2025-01-01'
GROUP BY u.name
HAVING COUNT(o.id) > 5
ORDER BY total_orders DESC;
\`\`\``,
  },
  {
    title: 'Roadmap Projet EvNote',
    content: `# Roadmap Projet EvNote

## Sprint actuel

- [x] Implémenter l'éditeur Markdown
- [x] Ajouter la palette de commandes
- [ ] Ajouter le support des images
- [ ] Exporter en PDF

## Bugs à corriger

- ( ) Crash au démarrage sur Linux
- (x) Fix du scroll dans la liste des notes
- ( ) Recherche FTS ne trouve pas les accents

## Notes

Le format \`( )\` et \`(x)\` utilise des bullets ronds au lieu de checkboxes.

Tandis que \`[ ]\` et \`[x]\` affiche de vraies **checkboxes** cliquables.

Priorités : \`haute\` > \`moyenne\` > \`basse\``,
  },
  {
    title: 'Guide de contribution',
    content: `# Guide de contribution

## Prérequis

Installer les dépendances avec :

\`\`\`bash
npm install
npm run electron:rebuild
\`\`\`

> **Important** : Ne pas oublier \`electron:rebuild\` après chaque \`npm install\`, sinon \`better-sqlite3\` ne fonctionnera pas.

## Architecture

Le projet suit cette structure :

| Dossier | Rôle |
|---------|------|
| \`electron/\` | Process principal |
| \`src/app/core/\` | Services Angular |
| \`src/app/features/\` | Composants UI |

## Checklist avant PR

- [ ] Code compile sans erreur
- [ ] Pas de \`console.log\` oublié
- [x] Tests passent
- [x] Lint propre

## Exemple de service

\`\`\`typescript
@Injectable({ providedIn: 'root' })
export class NotesService {
  private readonly _notes = signal<Note[]>([]);

  readonly notes = this._notes.asReadonly();

  async loadAll(): Promise<void> {
    const notes = await this.bridge.getAllNotes();
    this._notes.set(notes);
  }
}
\`\`\`

---

*Dernière mise à jour : mars 2026*
**Auteur** : ~~ancien dev~~ Yassine`,
  },
];
