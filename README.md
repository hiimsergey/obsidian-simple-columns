# Obsidian Simple Columns
Easily display your notes side-by-side using a simple tag syntax.

## Example
```markdown
## Text outside of columns
This is text coming before a column block. It will take up the full width of the page, like it usually does.

[begin]
## First column
This is text that is being displayed on the left.

[col]
- Second column
- This is text that is being displayed in the middle.

[col]
This is the third column. It is displayed on the right.
You can add as many columns as possible.

[end]

This text is outside of the columns blocks. It will take up the full page width again.
```

## Syntax

### Flexible amount of blocks
You can arrange more and more columns by adding more `[col]` tags between `[begin]` and `[end]` as well as making multiple blocks:

```markdown
outside

[begin]
column one

[col]
column two

[end]

outside

[begin]

[col]
column one

[col]
column two

[end]
```

### Custom width ratio
Some columns can take up more space that the others. Just add a number after a tag:

```markdown
These columns will have a width ratio of 1:2:1.

[begin]
first column

[col]2
second column with twice as much space as the others

[col]
third column

[end]
```

### Arrange blocks Right-to-Left
By default the first column starts on the left and new ones appear on the right. There is a **Default column arrangement** setting but you can also set it for each block individually. Add a keyword at the end of the `[col]` tag:

```markdown
[begin]2
- first column
- on the right

[col]
- second column
- on the left

[end]rl

outside text

[begin]
- first column
- on the left

[col]3
- second column
- on the right

[end]lr

[begin]
- first column
- uses setting value

[col]
- second column
- uses setting value

[end]
```