interface BrowserSessionBarProps {
  onSave: () => void;
  onLoad: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function BrowserSessionBar({ onSave, onLoad }: BrowserSessionBarProps) {
  return (
    <nav className="browser-session-bar" aria-label="Browser session controls">
      <div className="product-width browser-session-inner">
        <span>Browser workspace</span>
        <div>
          <button type="button" onClick={onSave}>Save session</button>
          <label>
            Load session
            <input type="file" accept=".json" onChange={onLoad} className="hidden" />
          </label>
        </div>
      </div>
    </nav>
  );
}
