export const getPercentage = (value: number, total: number) => {
  const percentage = ((total - value) * 100) / total;
  if (!isNaN(percentage)) {
    return percentage;
  }
  return 0;
};
