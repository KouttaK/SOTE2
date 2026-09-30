export function formatCounter(formatStr: string, value: number, padLength: number): string {
  const now = new Date();

  // Helper for letter sequences (1=A, 26=Z, 27=AA)
  const toSequenceLetter = (num: number): string => {
    let letStr = '';
    let temp = num;
    while (temp > 0) {
      let mod = (temp - 1) % 26;
      letStr = String.fromCharCode(65 + mod) + letStr;
      temp = Math.floor((temp - mod) / 26);
    }
    return letStr || 'A';
  };

  // Base counter value
  let valStr = String(value);
  if (padLength && padLength > 0) {
    const isNegative = value < 0;
    const absStr = String(Math.abs(value)).padStart(padLength, '0');
    valStr = isNegative ? `-${absStr}` : absStr;
  }

  // Replacements
  let result = formatStr;
  result = result.replace(/\{contador\}/g, valStr);
  result = result.replace(/\{ano\}/g, String(now.getFullYear()));
  result = result.replace(/\{mês\}/gi, String(now.getMonth() + 1).padStart(2, '0'));
  result = result.replace(/\{mes\}/gi, String(now.getMonth() + 1).padStart(2, '0'));
  result = result.replace(/\{dia\}/gi, String(now.getDate()).padStart(2, '0'));
  result = result.replace(/\{trimestre\}/gi, String(Math.ceil((now.getMonth() + 1) / 3)));
  result = result.replace(/\{letra\}/gi, toSequenceLetter(value));

  return result;
}
