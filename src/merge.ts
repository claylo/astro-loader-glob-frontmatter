type Data = Record<string, unknown>

export function deepMerge(target: Data, source: Data): Data {
  const result: Data = { ...target }
  for (const key of Object.keys(source)) {
    if (key === '__proto__' || key === 'constructor') continue
    const tVal = result[key]
    const sVal = source[key]
    if (
      typeof tVal === 'object' && tVal !== null && !Array.isArray(tVal) &&
      typeof sVal === 'object' && sVal !== null && !Array.isArray(sVal)
    ) {
      result[key] = deepMerge(tVal as Data, sVal as Data)
    } else {
      result[key] = sVal
    }
  }
  return result
}
