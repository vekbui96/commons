import { useState } from "react";
import { Button, Card, Field, Input, Select, Toast, useToast } from "@/ui";
import { conversions, formatNumber } from "./convert";
import "./units.css";

export default function UnitsApp() {
  const [conversionId, setConversionId] = useState(conversions[0]!.id);
  const [reversed, setReversed] = useState(false);
  const [input, setInput] = useState("1");
  const { show, toast } = useToast();

  const conversion = conversions.find((c) => c.id === conversionId) ?? conversions[0]!;
  const [fromUnit, toUnit] = reversed ? [conversion.to, conversion.from] : [conversion.from, conversion.to];
  const value = input.trim() === "" ? NaN : Number(input);
  const result = reversed ? conversion.backward(value) : conversion.forward(value);
  const formatted = formatNumber(result);
  const valid = Number.isFinite(result);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${formatted} ${toUnit}`);
      show(`Copied ${formatted} ${toUnit}`, "ok");
    } catch {
      show("Couldn't copy on this browser", "warn");
    }
  }

  return (
    <div className="units">
      <Field label="Convert">
        <Select value={conversionId} onChange={(e) => setConversionId(e.target.value)}>
          {conversions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.from} ↔ {c.to}
            </option>
          ))}
        </Select>
      </Field>

      <div className="units__row">
        <Field
          label={`Value in ${fromUnit}`}
          error={input.trim() !== "" && !valid ? "Enter a number" : undefined}
        >
          <Input
            className="num"
            inputMode="decimal"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoComplete="off"
          />
        </Field>
        <Button
          variant="secondary"
          className="units__swap"
          onClick={() => setReversed((r) => !r)}
          aria-label="Swap direction"
        >
          ⇄
        </Button>
      </div>

      <Card as="section" className="units__result" aria-label="Result">
        <p className="units__result-line" aria-live="polite">
          <span className="units__result-value num" data-testid="units-result">
            {formatted}
          </span>{" "}
          <span className="units__result-unit">{toUnit}</span>
        </p>
        <Button variant="secondary" onClick={copy} disabled={!valid}>
          Copy
        </Button>
      </Card>

      <Toast {...toast} />
    </div>
  );
}
