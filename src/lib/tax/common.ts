export const pctText = (r: number) => `${(r * 100).toLocaleString('it-IT', { maximumFractionDigits: 3 })}%`;
export const eurText = (n: number) => `${n.toLocaleString('it-IT', { maximumFractionDigits: 0 })} €`;
