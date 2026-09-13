---
name: ftir-peak-interpretation
description: Interpret FTIR spectra by assigning observed absorption bands to likely bond vibrations and functional-group classes using the supplied Table 7-3 as the primary reference. Do not identify an exact substance unless an external spectral/database match is explicitly available.
---

# FTIR Peak Interpretation Skill

## Purpose

Interpret an FTIR spectrum at the level of:

1. observed peak/band position;
2. likely bond vibration;
3. functional-group class;
4. supporting or conflicting bands;
5. confidence and ambiguity.

The skill is deliberately **not** an exact substance-identification system. Without a reference spectral database, FTIR interpretation should produce structural hypotheses, not a unique compound name.

The primary reference is **Table 7-3, "A Numerical Listing of Wavenumber Ranges in Which Some Functional Groups and Classes of Compounds Absorb in the Infrared"**, from the supplied document. The table gives wavenumber ranges, intensity descriptors, functional-group/classes, and assignment/remarks.

## Core rule

Never reason as:

> peak → exact substance

Reason as:

> peak position + band shape/intensity + neighboring bands → vibration → functional group → structural hypothesis

A single FTIR band is normally insufficient for a unique identification.

---

## Input

The input may be:

### A. Spectrum image

Use the spectrum image to obtain approximate peak positions manually or by image analysis.

Extract, where possible:

- x-axis limits and units;
- y-axis scale and whether it is absorbance or transmittance;
- baseline;
- local minima/maxima corresponding to absorption;
- peak wavenumbers;
- approximate intensity;
- peak width;
- shoulders and multiplets.

If automatic peak extraction is unreliable, ask the user to provide the peak positions manually.

### B. Peak list

Preferred structured input:

```text
Wavenumber (cm^-1) | Intensity/relative height | Width/shape | Notes
```

Example:

```text
3340 | strong | broad | 
2925 | strong | medium | 
1718 | strong | sharp |
1602 | medium | sharp |
```

### C. Spectrum plus manually marked peaks

Use the supplied peak positions as authoritative observations. Do not move them merely to fit the reference table.

---

# Peak detection

## Manual mode

If the spectrum is an image and automatic extraction is not reliable:

1. Identify the x-axis.
2. Determine whether the axis runs from high to low wavenumber, as is common for FTIR plots.
3. Mark all obvious absorption bands.
4. Record approximate peak centers in cm⁻¹.
5. Record broad bands separately from sharp bands.
6. Record shoulders when they may carry functional-group information.
7. Do not over-report noise as peaks.

For transmittance spectra, absorption usually corresponds to downward bands. For absorbance spectra, absorption usually corresponds to upward bands. Confirm this from the axis before detecting peaks.

## Automatic mode

If numerical spectrum data are available, detect peaks algorithmically rather than from the rendered image.

Recommended procedure:

1. Remove obvious baseline drift conservatively.
2. Apply only light smoothing.
3. Detect candidate local extrema.
4. Use prominence rather than absolute height as the primary peak criterion.
5. Detect broad bands with lower sensitivity than sharp peaks.
6. Preserve shoulders where they are chemically meaningful.
7. Return the original, unmodified peak position alongside any smoothed/detected position.

Do not invent peaks solely because a reference-table range exists.

If only an image is available, automatic extraction is optional and should be treated as approximate.

---

# Matching peaks to Table 7-3

For every observed peak, search the reference table by wavenumber range.

The output should contain:

| Observed peak | Reference range | Likely vibration | Functional group/class | Remarks | Confidence |
|---|---|---|---|---|---|

Use the table's terminology wherever possible.

A peak may match multiple entries. Do not force a single assignment.

## Range matching

For an observed peak `p`, identify all table entries satisfying:

```text
lower_bound <= p <= upper_bound
```

Rank candidates using:

1. proximity to the center of the reference range;
2. whether the observed band intensity agrees with the table;
3. whether the observed band is broad/sharp;
4. whether additional supporting bands are present;
5. whether another functional group explains the same band more plausibly.

The distance to the center of the range is only a ranking aid. It is **not** a chemical certainty criterion.

For broad ranges such as carboxylic-acid O–H stretching, the full range should be respected rather than assigning the peak to the midpoint.

---

# Functional-group interpretation

Interpret groups as groups of correlated bands.

Examples of the reasoning pattern:

### Carbonyl region

A strong band in the carbonyl region may indicate C=O stretching, but the exact class must be determined from additional evidence.

Possible classes in Table 7-3 include:

- anhydrides;
- acid halides;
- lactones;
- esters;
- aldehydes;
- ketones;
- carboxylic acids;
- amides;
- ureas;
- related carbonyl compounds.

Do not report simply:

> "1715 cm⁻¹ = ketone"

unless supporting evidence makes ketone substantially more plausible than the alternatives.

Report:

> "1715 cm⁻¹: C=O stretching; compatible with ketones and other carbonyl classes. Additional bands are required to discriminate."

### O–H / N–H region

Broad bands must be treated differently from sharp bands.

A broad absorption extending through a large part of the 3100–2400 cm⁻¹ region is compatible with hydrogen-bonded carboxylic-acid O–H according to Table 7-3.

Do not interpret every broad band near 3300 cm⁻¹ as an alcohol.

Potential alternatives include:

- alcohol/phenol O–H;
- amine/amide N–H;
- carboxylic-acid O–H;
- ammonium-containing species.

### C–H stretching

Bands around the high-wavenumber C–H region should be reported as C–H stretching first, then classified using the pattern and accompanying bands.

### C≡N / C≡C / N=C=O

Sharp bands in the 2100–2300 cm⁻¹ region are potentially diagnostic but should still be treated as assignments to bond vibrations rather than exact compounds.

Possible Table 7-3 assignments include:

- nitrile C≡N;
- alkyne C≡C;
- isocyanate N=C=O;
- diazonium N≡N;
- isonitrile N≡C;
- azide N₃;
- related unsaturated systems.

### Aromatic systems

Do not identify "benzene" from one band.

Use correlated evidence such as:

- aromatic C–H stretching;
- aromatic ring stretching;
- aromatic C–H out-of-plane deformation;
- substitution-pattern bands.

The table contains ranges for mono-, ortho-, meta-, para-, 1,2,3-, 1,2,4-, 1,2,3,4- and 1,3,5-substituted aromatic systems.

These bands may suggest a substitution pattern, but they should be reported as evidence, not as an exact structure.

---

# Intensity and shape

The table uses:

- `s` = strong
- `m` = medium
- `w` = weak
- `vs` = very strong
- `br` = broad

Use these descriptors when available.

Do not treat intensity as an absolute quantitative concentration measurement. Experimental conditions, path length, ATR contact, sample thickness, crystallinity, hydrogen bonding, orientation and instrument response affect intensity.

Shape information is particularly important:

- broad band → often associated with hydrogen bonding or overlapping vibrations;
- sharp band → potentially more specific vibration;
- doublet → may support assignments explicitly described as doublets in the table;
- shoulder → may indicate overlapping bands rather than a separate compound.

---

# Correlation logic

After assigning individual peaks, perform a second pass over the entire spectrum.

For each proposed functional group, ask:

1. Is the expected supporting band present?
2. Are there bands that contradict the assignment?
3. Is the group assignment based on one peak only?
4. Could another group explain the same peak?
5. Does the entire fingerprint region remain consistent?

Increase confidence when several independent bands support the same functional group.

Decrease confidence when:

- only one weak band supports the assignment;
- several functional groups overlap in the same range;
- the peak is broad or poorly resolved;
- the sample is a mixture;
- the baseline is poor;
- the relevant reference range is unusually broad.

---

# Mixtures and polymers

Assume that real samples may contain multiple components.

Do not force the spectrum into one molecular structure.

For polymeric, composite, filled, natural, or biological materials, report:

- dominant functional groups;
- probable matrix-related bands;
- possible additive/filler-related bands;
- overlapping or unresolved regions.

For composites, a band can arise from more than one component.

---

# Exact identification restriction

This skill must not claim:

> "The sample is compound X"

unless an external spectral database/reference spectrum or independently supplied structural information supports that conclusion.

Instead use wording such as:

- "consistent with";
- "compatible with";
- "likely assignment";
- "possible assignment";
- "supports the presence of";
- "cannot distinguish between X and Y from FTIR alone."

If the user asks "what substance is this?", answer at the highest defensible structural level:

```text
Observed:
1720 cm^-1

Assignment:
C=O stretching

Functional-group interpretation:
carbonyl-containing compound

Most compatible classes:
ester / ketone / aldehyde / carboxylic acid / amide, depending on supporting bands

Confidence:
medium

Required additional evidence:
supporting bands in the fingerprint and O–H/N–H/C–O regions
```

---

# Output format

For a normal interpretation, produce:

## 1. Peak assignment table

| Peak, cm⁻¹ | Vibration | Functional group/class | Confidence | Evidence |
|---:|---|---|---|---|
| ... | ... | ... | High/Medium/Low | ... |

## 2. Functional-group summary

Group the result into:

- O–H / N–H
- C–H
- C≡C / C≡N / related
- C=O
- C=C / aromatic
- C–O / C–N
- S-containing groups
- P-containing groups
- Si-containing groups
- fingerprint-region evidence

Only include categories supported by the observed spectrum.

## 3. Structural hypothesis

Give a qualitative statement such as:

> "The spectrum is consistent with an oxygenated organic material containing ester/carbonyl and C–O functionality. The data do not uniquely distinguish the molecular structure."

For polymers/composites:

> "The spectrum supports a polymeric/oxygenated matrix with [functional groups]. The observed bands alone are insufficient for exact component identification."

## 4. Ambiguities

Explicitly list assignments that cannot be distinguished from the available spectrum.

## 5. Missing evidence

State which additional peaks or measurements would resolve the ambiguity.

---

# Confidence scale

### High

The peak lies in a relatively characteristic range and there are multiple supporting bands.

### Medium

The peak fits the reference range well but overlaps with other possible assignments.

### Low

The peak is weak, broad, poorly resolved, or has several equally plausible assignments.

Never convert confidence into a probability unless a validated statistical model is available.

---

# Important safeguards

1. Never fabricate a peak.
2. Never move an observed peak to match a reference range.
3. Never treat a reference range as proof of a functional group.
4. Never identify an exact compound without database/reference support.
5. Never ignore overlapping assignments.
6. Always preserve the original measured peak position.
7. Distinguish observation from interpretation.
8. Prefer a small number of defensible assignments over an exhaustive list of possible groups.
9. Use the fingerprint region as supporting evidence, not as an automatic compound identifier.
10. If the spectrum quality is insufficient, say so.

---

# Recommended interpretation workflow

```text
INPUT SPECTRUM
      ↓
Determine axis and spectrum type
      ↓
Detect/mark observed peaks
      ↓
Record peak position + intensity + shape
      ↓
Match each peak against Table 7-3 ranges
      ↓
Generate candidate bond vibrations
      ↓
Resolve candidates using:
  • intensity
  • width/shape
  • neighboring bands
  • correlated functional-group bands
      ↓
Build functional-group profile
      ↓
Check contradictions and overlap
      ↓
Generate structural hypothesis
      ↓
State uncertainty and alternatives
      ↓
STOP — do not claim exact substance identity
```

# Reference handling

The supplied Table 7-3 is the primary lookup source for this skill. Its entries include wavenumber ranges and assignments spanning approximately 3700–400 cm⁻¹ and cover O–H, N–H, C–H, C≡C, C≡N, N=C=O, C=O, C=C, aromatic systems, nitro compounds, sulfonyl compounds, ethers, esters, alcohols, amines, phosphates, silicon compounds and related functional groups.

If an assignment is not supported by the supplied table, mark it as:

> `Outside primary reference — requires external reference`

Do not silently replace the supplied reference with another table.

