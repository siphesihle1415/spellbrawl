import { Either, JSONSchema, Schema } from "effect";

export const directorThemes = ["FIRE", "FROST", "STORM", "VOID"] as const;

const ThemeSchema = Schema.Literal(...directorThemes);

const EmbermawSchema = Schema.Struct({
  name: Schema.Literal("Embermaw", "Cinderfang", "Ashclaw"),
  title: Schema.Literal(
    "The Starved Flame",
    "The Furnace Beast",
    "Hunger of the Pyre",
  ),
  theme: ThemeSchema,
});

const ShardWardenSchema = Schema.Struct({
  name: Schema.Literal("Shard Warden", "Rift Sentinel", "Crystal Keeper"),
  title: Schema.Literal(
    "Keeper of the Rift",
    "The Fractured Guard",
    "Warden of Glass",
  ),
  theme: ThemeSchema,
});

const HexwyrmSchema = Schema.Struct({
  name: Schema.Literal("The Hexwyrm", "Vhar'Zul", "The Riftwyrm"),
  title: Schema.Literal(
    "Devourer Beyond the Veil",
    "The Last Calamity",
    "Sovereign of the Void",
  ),
  theme: ThemeSchema,
});

const FinisherSchema = Schema.Struct({
  name: Schema.Literal("Starfall", "Riftbreaker", "Twin Nova"),
  clue: Schema.Literal(
    "Player A holds FIST. Player B tears with HANDS APART. Player A finishes with OPEN PALM.",
    "Anchor with Player A's FIST, split the veil with Player B's HANDS APART, then OPEN PALM.",
    "FIST from A. HANDS APART from B. One final OPEN PALM from A.",
  ),
});

export const RunConfigurationSchema = Schema.Struct({
  embermaw: EmbermawSchema,
  shardWarden: ShardWardenSchema,
  hexwyrm: HexwyrmSchema,
  finisher: FinisherSchema,
});

export type RunConfiguration = typeof RunConfigurationSchema.Type;
export type DirectorTheme = typeof ThemeSchema.Type;

export const runConfigurationJsonSchema = JSONSchema.make(
  RunConfigurationSchema,
);

export function decodeRunConfiguration(
  input: unknown,
): RunConfiguration | null {
  return Either.getOrNull(
    Schema.decodeUnknownEither(RunConfigurationSchema, {
      onExcessProperty: "error",
    })(input),
  );
}
