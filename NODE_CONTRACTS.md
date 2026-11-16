# Node contracts

## Authoritative definitions

Node definitions live in `src/graph/model/node-definitions.js`.

Each definition provides, where applicable:

- stable node type
- display label and description
- input port types
- output port type
- parameter types
- default parameter values
- enum options
- inspector metadata

Use `getPortType()` for port lookup. Do not create a second defaults or ports
table in a component, renderer, or persistence helper.

## Value kinds

The evaluator currently returns these runtime value shapes:

- `scalar`: numeric value, optionally carrying a procedural field
- `color`: renderer-facing material description

Connections must match their declared types. `any` is reserved for explicitly
polymorphic ports.

## Connections

Ordinary connections use:

```js
{ from, to, toPort }
```

Parameter connections use:

```js
{ fromNode, fromPort, toNode, toParam }
```

Only one connection may occupy an input or parameter destination. Replacing a
connection must remove the previous edge for that destination. Both ordinary
and parameter connections participate in cycle detection.

## Evaluation rules

- Evaluation is explicit in `time`; it must not depend on React render timing.
- The same graph, parameters, inputs, timestamp, and rendering environment
  should produce the same result.
- Missing required inputs produce an error and do not silently produce a valid
  final output.
- Invalid or cyclic dependencies produce explicit errors.
- Parameter-driver values are resolved before the destination node operation.
- Shared operations belong in the evaluator or shared rendering utilities, not
  duplicated in node-specific UI code.

## Material and alpha

Color values are material descriptions consumed by the render engine. A Blend
output also carries a compositional value tree:

```js
{
  composite: {
    base: /* complete evaluated base material */,
    overlay: /* complete evaluated overlay material */,
    amount,
    mode,
  }
}
```

This tree is part of the node output, not a reference that downstream nodes may
resolve independently. Effects are represented as material data, including
blend, mask, blur, adjustment, and procedural information. Opacity is preserved
through the scene bridge and applied by the renderer.

Any change to blend amount, blend mode, effect order, opacity, or alpha handling
requires regression coverage for at least one connected graph combination.
