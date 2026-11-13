// Decades group the classic mechanics; the last two are original 2020s games.
export const districtCatalog = Object.freeze([
 {id:'snake',era:'1970s',accent:'#8ed4b1'},
 {id:'breakout',era:'1970s',accent:'#e2ba73'},
 {id:'blocks',era:'1980s',accent:'#e2ba73'},
 {id:'tanks',era:'1980s',accent:'#8ed4b1'},
 {id:'flight',era:'1980s',accent:'#8db8e0'},
 {id:'sokoban',era:'1980s',accent:'#bc9cdb'},
 {id:'heist',era:'2020s',accent:'#8db8e0'},
 {id:'chase',era:'2020s',accent:'#e2ba73'}
]);

// Native-pixel screen crops from approved generated artwork, not new buildings.
export const districtSigns=Object.freeze({
 blocks:{image:'base',rect:[180,240,155,80]},
 tanks:{image:'base',rect:[520,240,155,80]},
 flight:{image:'base',rect:[862,240,155,80]},
 snake:{image:'signs',rect:[222,244,180,92]},
 breakout:{image:'signs',rect:[688,244,160,92]},
 sokoban:{image:'base',rect:[520,632,155,80]},
 heist:{image:'base',rect:[862,632,155,80]},
 chase:{image:'base',rect:[180,632,155,80]},
 vault:{image:'base',rect:[1206,240,155,80]}
});
