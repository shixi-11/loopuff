// Original 2D signs for the two playable scenes. They are decorative, not controls.
export function arcadeArt(kind){
 const scene=kind==='jump'
  ? `<path d="M42 168Q91 122 135 161L122 191 80 210 54 192Z" fill="#688f79"/><ellipse cx="89" cy="163" rx="47" ry="13" fill="#dce8c1"/>
     <path d="M235 105Q278 79 320 111L305 142 274 157 247 139Z" fill="#688f79"/><ellipse cx="278" cy="108" rx="43" ry="12" fill="#dce8c1"/>
     <path d="M111 133Q187 31 258 87" fill="none" stroke="#527d70" stroke-width="2" stroke-dasharray="3 8"/>
     <g transform="translate(180 78) rotate(24)"><path d="M0-31Q9-4 28 18L9 13Q0 25-9 13L-28 18Q-9-4 0-31Z" fill="#f8f4dd"/><path d="M0-31L0 22-9 13-28 18Q-9-4 0-31Z" fill="#b0c8af"/><ellipse cy="-6" rx="4" ry="8" fill="#28584d"/><path d="M-4 21L0 35 4 21" fill="#d79e56"/></g>
     <circle cx="278" cy="76" r="5" fill="#ddb96c"/>`
  : `<rect x="106" y="41" width="149" height="151" rx="17" fill="#759d88"/><rect x="113" y="45" width="139" height="142" rx="14" fill="#315f54"/>
     <circle cx="183" cy="115" r="61" fill="#b1c9ac" stroke="#254f47" stroke-width="3"/><circle cx="183" cy="115" r="48" fill="#527e6b" stroke="#dce3ba" stroke-width="2"/>
     <path d="M183 85V145M157 130L209 100M157 100L209 130" stroke="#e7c386" stroke-width="7" stroke-linecap="round"/><circle cx="183" cy="115" r="13" fill="#e7c386"/><circle cx="183" cy="115" r="5" fill="#315f54"/>
     <path d="M116 83H103M116 146H103M249 93H263M249 137H263" stroke="#28564b" stroke-width="6" stroke-linecap="round"/>
     <path d="M72 74L76 84 86 88 76 92 72 102 68 92 58 88 68 84Z" fill="#e7c386"/>`;
 return `<svg viewBox="0 0 360 230" aria-hidden="true" focusable="false"><ellipse cx="180" cy="200" rx="104" ry="11" fill="#8baa8c" opacity=".22"/>${scene}</svg>`;
}
