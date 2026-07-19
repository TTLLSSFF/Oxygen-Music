function pad(n) {
  return String(n).padStart(2, '0')
}

export function formatDate(input, format = 'YYYY-MM-DD') {
  if (!input && input !== 0) return ''
  const date = new Date(input)
  if (isNaN(date.getTime())) return String(input)
  const map = {
    YYYY: String(date.getFullYear()),
    MM: pad(date.getMonth() + 1),
    DD: pad(date.getDate()),
    HH: pad(date.getHours()),
    mm: pad(date.getMinutes()),
    ss: pad(date.getSeconds()),
  }
  return format.replace(/YYYY|MM|DD|HH|mm|ss/g, (key) => map[key])
}

export function formatDateTime(input) {
  return formatDate(input, 'YYYY-MM-DD HH:mm:ss')
}
