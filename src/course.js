// Original introductory course. Content ids and executable text do not change with locale.
export const course = [
  {
    id:'signal', source:'7.log()', logs:['7'], fragments:['7','.log','()'],
    prediction:['7','0',''], predictionAnswer:0,
    remix:{template:'___.log()',solution:'9',source:'9.log()',logs:['9']},
    independent:{logs:['12'],require:[],example:'12.log()'}
  },
  {
    id:'addition',source:'(2 + 3).log()',logs:['5'],fragments:['(2 + 3)','.log','()'],
    prediction:['6','5','23'],predictionAnswer:1,
    remix:{template:'(2 + ___).log()',solution:'6',source:'(2 + 6).log()',logs:['8']},
    independent:{logs:['11'],require:['add'],example:'(4 + 7).log()'}
  },
  {
    id:'names',source:'let n = 5;\n(n + 2).log()',logs:['7'],fragments:['let n = 5;','\n','(n + 2)','.log','()'],
    prediction:['5','2','7'],predictionAnswer:2,
    remix:{template:'let n = ___;\n(n + 2).log()',solution:'8',source:'let n = 8;\n(n + 2).log()',logs:['10']},
    // The parser requires every name to be bound. Count using that binding once;
    // a separate 'bind' criterion would double-weight the same dependency.
    independent:{logs:['14'],require:['name','add'],example:'let energy = 10; (energy + 4).log()'}
  },
  {
    id:'leap',source:'(2 + 3).log()',logs:['5'],fragments:['(2 + 3)','.log','()'],
    prediction:['3','5','23'],predictionAnswer:1,
    remix:{template:'(2 + ___).log()',solution:'5',source:'(2 + 5).log()',logs:['7']},
    independent:{logs:['6'],require:['add'],example:'(2 + 4).log()'},
    world:{kind:'jump',maximum:12}
  },
  {
    "id": "comparison",
    "track": "tolang",
    "source": "let fuel = 6;\n(fuel > 4).log()",
    "logs": [
      "true"
    ],
    "fragments": [
      "let fuel = 6;\n",
      "(fuel > 4)",
      ".log()"
    ],
    "prediction": [
      "true",
      "false",
      "6"
    ],
    "predictionAnswer": 0,
    "remix": {
      "template": "let fuel = ___;\n(fuel > 4).log()",
      "solution": "3",
      "source": "let fuel = 3;\n(fuel > 4).log()",
      "logs": [
        "false"
      ]
    },
    "independent": {
      "logs": [
        "true",
        "false"
      ],
      "require": [
        "compare"
      ],
      "example": "(8 > 5).log(); (2 > 9).log()"
    },
    "mode": "lab"
  },
  {
    "id": "branch",
    "track": "tolang",
    "source": "let fuel = 6;\nif fuel > 4 then {\n  1.log()\n} else {\n  2.log()\n}",
    "logs": [
      "1"
    ],
    "fragments": [
      "let fuel = 6;\n",
      "if fuel > 4 then {\n",
      "  1.log()\n",
      "} else {\n",
      "  2.log()\n",
      "}"
    ],
    "prediction": [
      "1",
      "2",
      "1 → 2"
    ],
    "predictionAnswer": 0,
    "remix": {
      "template": "let fuel = ___;\nif fuel > 4 then { 1.log() } else { 2.log() }",
      "solution": "2",
      "source": "let fuel = 2;\nif fuel > 4 then { 1.log() } else { 2.log() }",
      "logs": [
        "2"
      ]
    },
    "independent": {
      "logs": [
        "2"
      ],
      "require": [
        "compare",
        "if",
        "name"
      ],
      "example": "let fuel = 3; if fuel > 4 then { 1.log() } else { 2.log() }"
    },
    "mode": "lab"
  },
  {
    "id": "repeat",
    "track": "tolang",
    "source": "for dock in [2, 4, 6] {\n  dock.log()\n}",
    "logs": [
      "2",
      "4",
      "6"
    ],
    "fragments": [
      "for dock in [2, 4, 6] {\n",
      "  dock.log()\n",
      "}"
    ],
    "prediction": [
      "2 → 4 → 6",
      "6",
      "2 → 2 → 2"
    ],
    "predictionAnswer": 0,
    "remix": {
      "template": "for dock in [2, 4, ___] { dock.log() }",
      "solution": "8",
      "source": "for dock in [2, 4, 8] { dock.log() }",
      "logs": [
        "2",
        "4",
        "8"
      ]
    },
    "independent": {
      "logs": [
        "3",
        "5",
        "7"
      ],
      "require": [
        "for",
        "name"
      ],
      "example": "for dock in [3, 5, 7] { dock.log() }",
      "dataRequire": [
        "for"
      ]
    },
    "mode": "lab"
  },
  {
    "id": "counter",
    "track": "tolang",
    "source": "let tick = 1;\nwhile tick < 4 {\n  tick.log();\n  tick = tick + 1\n}",
    "logs": [
      "1",
      "2",
      "3"
    ],
    "fragments": [
      "let tick = 1;\n",
      "while tick < 4 {\n",
      "  tick.log();\n",
      "  tick = tick + 1\n",
      "}"
    ],
    "prediction": [
      "1 → 2 → 3",
      "1 → 2 → 3 → 4",
      "1"
    ],
    "predictionAnswer": 0,
    "remix": {
      "template": "let tick = 1;\nwhile tick < ___ { tick.log(); tick = tick + 1 }",
      "solution": "5",
      "source": "let tick = 1;\nwhile tick < 5 { tick.log(); tick = tick + 1 }",
      "logs": [
        "1",
        "2",
        "3",
        "4"
      ]
    },
    "independent": {
      "logs": [
        "2",
        "3",
        "4"
      ],
      "require": [
        "while",
        "compare",
        "name",
        "add"
      ],
      "example": "let tick = 2; while tick < 5 { tick.log(); tick = tick + 1 }"
    },
    "mode": "lab"
  },
  {
    "id": "function",
    "track": "tolang",
    "source": "sync fn combine(a, b) {\n  return a + b\n};\nlet load = combine(3, 4);\nload.log()",
    "logs": [
      "7"
    ],
    "fragments": [
      "sync fn combine(a, b) {\n",
      "  return a + b\n",
      "};\n",
      "let load = combine(3, 4);\n",
      "load.log()"
    ],
    "prediction": [
      "7",
      "3",
      "4"
    ],
    "predictionAnswer": 0,
    "remix": {
      "template": "sync fn combine(a, b) { return a + b };\nlet load = combine(3, ___);\nload.log()",
      "solution": "6",
      "source": "sync fn combine(a, b) { return a + b };\nlet load = combine(3, 6);\nload.log()",
      "logs": [
        "9"
      ]
    },
    "independent": {
      "logs": [
        "12"
      ],
      "require": [
        "call",
        "name",
        "add"
      ],
      "example": "sync fn total(a, b) { return a + b }; let load = total(5, 7); load.log()",
      "dataRequire": [
        "call",
        "add"
      ]
    },
    "mode": "lab"
  },
  {
    "id": "reply",
    "track": "tolang",
    "source": "fn boost(load) {\n  return ! (load + 2)\n};\nlet result = boost(5);\nresult.log()",
    "logs": [
      "7"
    ],
    "fragments": [
      "fn boost(load) {",
      "\n  return ! (load + 2)",
      "\n};\n",
      "let result = boost(5);",
      "\nresult.log()"
    ],
    "prediction": [
      "5",
      "7",
      ""
    ],
    "predictionAnswer": 1,
    "remix": {
      "template": "fn boost(load) {\n  return ! (load + 2)\n};\nlet result = boost(___);\nresult.log()",
      "solution": "8",
      "source": "fn boost(load) {\n  return ! (load + 2)\n};\nlet result = boost(8);\nresult.log()",
      "logs": [
        "10"
      ]
    },
    "independent": {
      "logs": [
        "12"
      ],
      "require": [
        "reply",
        "call",
        "name",
        "add"
      ],
      "example": "fn boost(value) { return ! (value + 5) }; let answer = boost(7); answer.log()",
      "dataRequire": [
        "reply",
        "call",
        "add"
      ]
    },
    "explanationAnswer": 1,
    "mode": "lab"
  },
  {
    "id": "message",
    "track": "advanced",
    "source": "let parcel;\n{ parcel ! 7\n| ?(value <- parcel) {\n  value.log()\n} }",
    "logs": [
      "7"
    ],
    "fragments": [
      "let parcel;\n",
      "{ parcel ! 7\n",
      "| ?(value <- parcel) {\n",
      "  value.log()\n",
      "} }"
    ],
    "prediction": [
      "7",
      "0",
      ""
    ],
    "predictionAnswer": 0,
    "remix": {
      "template": "let parcel;\n{ parcel ! ___ | ?(value <- parcel) { value.log() } }",
      "solution": "9",
      "source": "let parcel;\n{ parcel ! 9 | ?(value <- parcel) { value.log() } }",
      "logs": [
        "9"
      ]
    },
    "independent": {
      "logs": [
        "11"
      ],
      "require": [
        "send",
        "receive",
        "name"
      ],
      "example": "let parcel; { parcel ! 11 | ?(value <- parcel) { value.log() } }",
      "dataRequire": [
        "receive",
        "send"
      ]
    },
    "mode": "lab"
  },
  {
    "id": "join",
    "track": "advanced",
    "source": "let west; let east;\n{ west ! 4\n| east ! 6\n| ?(a <- west & b <- east) {\n  (a + b).log()\n} }",
    "logs": [
      "10"
    ],
    "fragments": [
      "let west; let east;\n",
      "{ west ! 4\n",
      "| east ! 6\n",
      "| ?(a <- west & b <- east) {\n",
      "  (a + b).log()\n",
      "} }"
    ],
    "prediction": [
      "10",
      "4 → 6",
      "4"
    ],
    "predictionAnswer": 0,
    "remix": {
      "template": "let west; let east;\n{ west ! 4 | east ! ___ | ?(a <- west & b <- east) { (a + b).log() } }",
      "solution": "8",
      "source": "let west; let east;\n{ west ! 4 | east ! 8 | ?(a <- west & b <- east) { (a + b).log() } }",
      "logs": [
        "12"
      ]
    },
    "independent": {
      "logs": [
        "15"
      ],
      "require": [
        "send",
        "receive",
        "join",
        "name",
        "add"
      ],
      "example": "let west; let east; { west ! 7 | east ! 8 | ?(a <- west & b <- east) { (a + b).log() } }",
      "dataRequire": [
        "join",
        "receive",
        "send",
        "add"
      ]
    },
    "mode": "lab"
  },
  {
    "id": "coordination",
    "track": "advanced",
    "source": "sync fn total(a, b) {\n  return a + b\n};\nlet west; let east;\n{ west ! 6 | east ! 7\n| ?(a <- west & b <- east) {\n  let load = total(a, b);\n  if load > 12 then {\n    (load + 5).log()\n  } else { load.log() }\n} }",
    "logs": [
      "18"
    ],
    "fragments": [
      "sync fn total(a, b) {\n",
      "  return a + b\n",
      "};\nlet west; let east;\n",
      "{ west ! 6 | east ! 7\n",
      "| ?(a <- west & b <- east) {\n",
      "  let load = total(a, b);\n",
      "  if load > 12 then {\n",
      "    (load + 5).log()\n",
      "  } else { load.log() }\n",
      "} }"
    ],
    "prediction": [
      "18",
      "13",
      "6 → 7"
    ],
    "predictionAnswer": 0,
    "remix": {
      "template": "sync fn total(a, b) { return a + b };\nlet west; let east;\n{ west ! 6 | east ! ___ | ?(a <- west & b <- east) { let load = total(a, b); if load > 12 then { (load + 5).log() } else { load.log() } } }",
      "solution": "8",
      "source": "sync fn total(a, b) { return a + b };\nlet west; let east;\n{ west ! 6 | east ! 8 | ?(a <- west & b <- east) { let load = total(a, b); if load > 12 then { (load + 5).log() } else { load.log() } } }",
      "logs": [
        "19"
      ]
    },
    "independent": {
      "logs": [
        "18"
      ],
      "require": [
        "send",
        "receive",
        "join",
        "name",
        "add",
        "call",
        "if",
        "compare"
      ],
      "example": "sync fn total(a, b) { return a + b }; let west; let east; { west ! 6 | east ! 7 | ?(a <- west & b <- east) { let load = total(a, b); if load > 12 then { (load + 5).log() } else { load.log() } } }",
      "dataRequire": [
        "join",
        "receive",
        "send",
        "add",
        "call"
      ]
    },
    "mode": "lab"
  }
];
export const locales = [
  ['zh','简体中文'],['zh-Hant','繁體中文'],['en','English'],['de','Deutsch'],['es','Español'],['fr','Français'],
  ['vi','Tiếng Việt'],['ru','Русский'],['uk','Українська'],['ar','العربية'],['ja','日本語'],['ko','한국어']
];
