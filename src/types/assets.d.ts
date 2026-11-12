declare module '*.wasm?inline' {
  const dataUrl: string;
  export default dataUrl;
}

declare module '*.woff2?inline' {
  const dataUrl: string;
  export default dataUrl;
}
declare module 'virtual:resvg-wasm-base64' {
  const base64: string;
  export default base64;
}
