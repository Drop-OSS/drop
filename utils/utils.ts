export const getPercentage = (value: number, total: number) => {
  const percentage = (value * 100) / total;
  if (!isNaN(percentage)) {
    return percentage;
  }
  return 0;
};
