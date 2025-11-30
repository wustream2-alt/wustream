export function paginate(arr, page = 1, limit = 50) {
  const start = (page - 1) * limit;
  return arr.slice(start, start + limit);
}
