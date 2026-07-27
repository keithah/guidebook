import { lineBadgeStyle, lineLabel } from '../theme.js';

export default function LineBadge({ line, size, fontSize }) {
  return <div style={lineBadgeStyle(line, { size, fontSize })}>{lineLabel(line)}</div>;
}
