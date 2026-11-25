/**
 * Live tools. Keep this list in the same order as the nav and the sitemap.
 */
export const TRADEMARK =
  "Wingdings is a trademark of Microsoft Corporation. This site is not affiliated with or endorsed by Microsoft. No Microsoft font files are used.";

export const tools = [
  {
    id: "morse",
    name: "Morse Code Translator",
    path: "/",
    title: "Morse Code Translator \u2013 Text to Morse & Morse to Text, with Sound",
    h1: "Morse Code Translator",
    description:
      "Turn text into Morse code or Morse code into text, then copy it, play it, or download a sound file. Everything runs in your browser.",
    lede: "Turn text into Morse code, or Morse code back into text, and play it as sound.",
    blurb: "Turn dots and dashes into words, or words into sound.",
    script: "/js/morse-page.js",
    og: "/og/morse.png",
  },
  {
    id: "anagram",
    name: "Anagram Solver",
    path: "/anagram-solver/",
    title: "Anagram Solver \u2013 Find Every Word From Your Letters",
    h1: "Anagram Solver",
    description:
      "Rearrange every letter into real English words. Common words come first. The search runs in your browser.",
    lede: "Rearrange all of your letters into real words, with the most common words first.",
    blurb: "Use every letter to find real words.",
    script: "/js/letters-page.js",
    og: "/og/anagram.png",
  },
  {
    id: "unscramble",
    name: "Unscramble Words",
    path: "/unscramble-words/",
    title: "Unscramble Words \u2013 Word Unscrambler for Any Letters",
    h1: "Unscramble Words",
    description:
      "Find every English word you can spell from a pile of letters, long words first. It runs in your browser.",
    lede: "See every word you can spell from your letters, with longer words first.",
    blurb: "Find every word those letters can spell.",
    script: "/js/letters-page.js",
    og: "/og/unscramble.png",
  },
  {
    id: "sudoku",
    name: "Sudoku Solver",
    path: "/sudoku-solver/",
    title: "Sudoku Solver \u2013 Solve Any Sudoku or Get a Hint",
    h1: "Sudoku Solver",
    description:
      "Solve a standard 9 by 9 sudoku or take one next step with a short reason. The puzzle never leaves your browser.",
    lede: "Solve a standard 9 by 9 sudoku, or take one next step with a plain reason.",
    blurb: "Fill a 9 by 9 sudoku or ask for one hint.",
    script: "/js/sudoku-page.js",
    og: "/og/sudoku.png",
  },
  {
    id: "maze",
    name: "Maze Generator",
    path: "/maze-generator/",
    title: "Maze Generator \u2013 Free Printable Mazes With Answers",
    h1: "Maze Generator",
    description: "Make a printable maze with one path and a separate answer page. It is drawn in your browser.",
    lede: "Make a printable maze with one path from the top-left opening to the bottom-right opening.",
    blurb: "Print a maze and its answer.",
    script: "/js/maze-page.js",
    og: "/og/maze.png",
  },
  {
    id: "wingdings",
    name: "Wingdings Translator",
    path: "/wingdings-translator/",
    title: "Wingdings Translator \u2013 Text to Symbols and Back",
    h1: "Wingdings Translator",
    description:
      "Turn text into Wingdings symbols and symbols back into text. The page uses its own font and does not download a Microsoft font.",
    lede: "Turn normal text into Wingdings symbols, or turn those symbols back into text.",
    blurb: "Turn text into symbols and symbols back into text.",
    script: "/js/wingdings-page.js",
    og: "/og/wingdings.png",
    symbols: true,
  },
  {
    id: "wordsearch",
    name: "Word Search Generator",
    path: "/word-search-generator/",
    title: "Word Search Generator \u2013 Free Printable Word Search Maker",
    h1: "Word Search Generator",
    description: "Free word search maker. Build a printable puzzle from your own words. It is made in your browser.",
    lede: "Turn your word list into a printable word search, with a separate answer page.",
    blurb: "Make a printable word search.",
    script: "/js/wordsearch-page.js",
    og: "/og/word-search.png",
  },
  {
    id: "cryptogram",
    name: "Cryptogram Solver",
    path: "/cryptogram-solver/",
    title: "Cryptogram Solver \u2013 Crack Letter-Substitution Puzzles",
    h1: "Cryptogram Solver",
    description: "Solve a letter-substitution puzzle from ordinary English words. The coded text stays in your browser.",
    lede: "Find the most likely reading of a letter-substitution puzzle, using ordinary English words.",
    blurb: "Solve a letter-substitution puzzle.",
    script: "/js/cryptogram-page.js",
    og: "/og/cryptogram.png",
  },
  {
    id: "crossword",
    name: "Crossword Solver",
    path: "/crossword-solver/",
    title: "Crossword Solver \u2013 Find Words by Known Letters",
    h1: "Crossword Solver",
    description: "Find words that fit the letters you know. This tool does not read clues. The search runs in your browser.",
    lede: "This tool finds words that fit the letters you know. It does not read clues.",
    blurb: "Find words that fit the letters you know.",
    script: "/js/crossword-page.js",
    og: "/og/crossword.png",
  },
];

export function liveTools() {
  return tools;
}
