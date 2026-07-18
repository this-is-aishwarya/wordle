"""Verify the Wordle scoring algorithm by re-implementing it in Python
and running the same test cases the plan calls out. Run from the project root:
    python3 tests/test_scoring.py
"""
import sys

def score_guess(guess: str, target: str):
    L = len(guess)
    assert len(target) == L, f"length mismatch: {guess} vs {target}"
    scores = [None] * L
    remaining = {}

    # Pass 1: exact matches
    for i in range(L):
        if guess[i] == target[i]:
            scores[i] = 'correct'
        else:
            t = target[i]
            remaining[t] = remaining.get(t, 0) + 1

    # Pass 2: present / absent
    for i in range(L):
        if scores[i] == 'correct':
            continue
        g = guess[i]
        if remaining.get(g, 0) > 0:
            scores[i] = 'present'
            remaining[g] -= 1
        else:
            scores[i] = 'absent'
    return scores


CASES = [
    # (target, guess, expected, label)
    ('HELLO', 'HELLO', ['correct']*5, 'all-green exact match'),
    ('ABCDE', 'EDCBA', ['present','present','correct','present','present'], 'all-yellow permutation except green C match'),
    ('AUDIO', 'ABOUT', ['correct','absent','present','present','absent'], 'AUDIO vs ABOUT (mixed)'),
    ('MAMMA', 'MAXIM', ['correct','correct','absent','absent','present'], 'MAMMA vs MAXIM (critical duplicates)'),
    ('APPLE', 'PAPER', ['present','present','correct','present','absent'], 'APPLE vs PAPER (only one P)'),
    ('ALLEN', 'LLAMA', ['present','correct','present','absent','absent'], 'ALLEN vs LLAMA (one L, two As)'),
    ('APPLE', 'CRANE', ['absent','absent','present','absent','correct'], 'APPLE vs CRANE (A present, E green)'),
    ('ABBEY', 'BABES', ['present','present','correct','correct','absent'], 'ABBEY vs BABES'),
    ('SPEED', 'SLEEP', ['correct','absent','correct','correct','present'], 'SPEED vs SLEEP (two Es in target)'),
    ('SLEEP', 'SPEED', ['correct','present','correct','correct','absent'], 'SLEEP vs SPEED (P in target)'),
    # Extra edge cases
    ('ROBOT', 'COUNT', ['absent','correct','absent','absent','correct'], 'ROBOT vs COUNT (O and T green)'),
    ('ROBOT', 'ROBOT', ['correct']*5, 'exact match again'),
    ('ALONE', 'LOANS', ['present','present','present','correct','absent'], 'ALONE vs LOANS (L,O,A present, N green)'),
]


def main():
    failed = 0
    for target, guess, expected, label in CASES:
        got = score_guess(guess, target)
        ok = got == expected
        marker = 'OK ' if ok else 'FAIL'
        if not ok:
            failed += 1
        print(f"  [{marker}] {label}: {got}" + ("" if ok else f"  (expected {expected})"))
    print()
    if failed:
        print(f"{failed} test(s) FAILED")
        sys.exit(1)
    print(f"All {len(CASES)} cases passed.")


if __name__ == '__main__':
    main()
