'use strict';
/**
 * js/grade-scope.js
 * Korean 2022 Math Curriculum — grade/semester difficulty scope.
 * Exposes window.GradeScope.get(grade, semester) → scope object or null.
 *
 * Properties:
 *   ops      — allowed operators for question generation
 *   maxNum   — max operand for +/- questions (× always uses 2–9)
 *   tables   — allowed multiplication table factors (empty = no × yet)
 *   seqMax   — max sequence start value (for missing-number)
 *   seqSteps — allowed step sizes in sequences (for missing-number)
 */
(function () {
  const S = {
    '1-1': { ops:['+'],              maxNum:9,   tables:[],                 seqMax:9,    seqSteps:[1]            },
    '1-2': { ops:['+','-'],          maxNum:20,  tables:[],                 seqMax:20,   seqSteps:[1,2]          },
    '2-1': { ops:['+','-'],          maxNum:20,  tables:[],                 seqMax:50,   seqSteps:[1,2,5]        },
    '2-2': { ops:['+','-','×'],      maxNum:20,  tables:[2,3,4,5,6,7,8,9], seqMax:50,   seqSteps:[1,2,5,10]     },
    '3-1': { ops:['+','-','×'],      maxNum:30,  tables:[2,3,4,5,6,7,8,9], seqMax:100,  seqSteps:[1,2,5,10]     },
    '3-2': { ops:['+','-','×','÷'],  maxNum:30,  tables:[2,3,4,5,6,7,8,9], seqMax:100,  seqSteps:[1,2,5,10]     },
    '4-1': { ops:['+','-','×','÷'],  maxNum:50,  tables:[2,3,4,5,6,7,8,9], seqMax:200,  seqSteps:[1,2,5,10,100] },
    '4-2': { ops:['+','-','×','÷'],  maxNum:50,  tables:[2,3,4,5,6,7,8,9], seqMax:200,  seqSteps:[1,2,5,10,100] },
    '5-1': { ops:['+','-','×','÷'],  maxNum:100, tables:[2,3,4,5,6,7,8,9], seqMax:500,  seqSteps:[1,2,5,10,100] },
    '5-2': { ops:['+','-','×','÷'],  maxNum:100, tables:[2,3,4,5,6,7,8,9], seqMax:500,  seqSteps:[1,2,5,10,100] },
    '6-1': { ops:['+','-','×','÷'],  maxNum:100, tables:[2,3,4,5,6,7,8,9], seqMax:1000, seqSteps:[1,2,5,10,100] },
    '6-2': { ops:['+','-','×','÷'],  maxNum:100, tables:[2,3,4,5,6,7,8,9], seqMax:1000, seqSteps:[1,2,5,10,100] },
  };

  window.GradeScope = {
    /** Returns scope object for given grade (1–6) and semester (1–2), or null if grade is falsy. */
    get(grade, semester) {
      if (!grade) return null;
      return S[`${grade}-${semester || 1}`] || S['3-1'];
    },
  };
})();
