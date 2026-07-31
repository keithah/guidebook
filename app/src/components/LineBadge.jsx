import { lineBadgeStyle, lineLabel } from '../theme.js';
import BartLogo from './BartLogo.jsx';

export default function LineBadge({ line, size, fontSize }) {
  if (line === 'BART') {
    return (
      <div role="img" aria-label="BART" style={lineBadgeStyle(line, { size, fontSize })}>
        <BartLogo height={(size ?? 28) * 0.48} decorative />
      </div>
    );
  }

  return <div style={lineBadgeStyle(line, { size, fontSize })}>{lineLabel(line)}</div>;
}
