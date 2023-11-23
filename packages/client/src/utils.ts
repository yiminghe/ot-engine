let uuid = 0;

export function getUuid() {
  return `${++uuid}`;
}
