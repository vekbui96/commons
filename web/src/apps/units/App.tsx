import { useId, useState } from "react";
import { conversions, formatNumber } from "./convert";
import "./units.css";

export default function UnitsApp() {
  const [conversionId, setConversionId] = useState(conversions[0]!.id);
  const [reversed, setReversed] = useState(false);
  const [input, setInput] = useState("1");
  const inputId = useId();
  const pairId = useId();

  const conversion = conversions.find((c) => c.id === conversionId) ?? conversions[0]!;
  const [fromUnit, toUnit] = reversed ? [conversion.to, conversion.from] : [conversion.from, conversion.to];
  const value = input.trim() === "" ? NaN : Number(input);
  const result = reversed ? conversion.backward(value) : conversion.forward(value);

  return (
    <div className="units">
      <div className="units__field">
        <label htmlFor={pairId}>Convert</label>
        <select id={pairId} value={conversionId} onChange={(e) => setConversionId(e.target.value)}>
          {conversions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.from} ↔ {c.to}
            </option>
          ))}
        </select>
      </div>

      <div className="units__row">
        <div className="units__field">
          <label htmlFor={inputId}>Value in {fromUnit}</label>
          <input
            id={inputId}
            inputMode="decimal"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoComplete="off"
          />
        </div>
        <button
          type="button"
          className="units__swap"
          onClick={() => setReversed((r) => !r)}
          aria-label="Swap direction"
        >
          ⇄
        </button>
      </div>

      <p className="units__result" aria-live="polite">
        <span className="units__result-value" data-testid="units-result">
          {formatNumber(result)}
        </span>{" "}
        <span className="units__result-unit">{toUnit}</span>
      </p>
    </div>
  );
}
