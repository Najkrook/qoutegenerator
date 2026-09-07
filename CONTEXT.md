# Quote Generator

Quote Generator creates, versions, and distributes commercial quotes while linking internal sales work to CRM deals.

## Language

**Quote**:
A customer-facing commercial proposal with a stable identity and one or more Quote Revisions.
_Avoid_: Proposal, estimate

**Quote Revision**:
A versioned snapshot of a Quote created by a successful Quote Save.
_Avoid_: Copy, autosave

**Quote Save**:
An operation that creates the first Quote Revision or adds a later one. It succeeds when that revision is persisted; secondary synchronization and logging outcomes do not invalidate it.
_Avoid_: CRM sync, activity log

**Activity Log Entry**:
A non-authoritative operational record of a user action. Its absence does not invalidate the recorded action.
_Avoid_: Audit record

**Quote Owner**:
The account that owns a Quote across all of its Quote Revisions. A new Quote belongs to the actor who creates it unless an owner is explicitly selected before the first Quote Save.
_Avoid_: Saver, editor

**Quote Origin**:
The stable classification of a Quote as internal or retailer-created, established by its first Quote Revision.
_Avoid_: Current actor type

**CRM Link**:
An exclusive association between one Quote and one CRM Deal. Changing either side of the association requires an explicit unlink or relink decision.
_Avoid_: Implicit synchronization

**Save Intent**:
One deliberate request to create a Quote Revision. Retrying the same Save Intent must not create another Quote Revision.
_Avoid_: Retry, duplicate save

**CRM Synchronization Issue**:
A durable, repairable record that a Quote Save succeeded while its CRM Link could not be synchronized.
_Avoid_: Failed Quote Save

**CRM Repair**:
A repeatable attempt to resolve a CRM Synchronization Issue without creating another Quote Revision.
_Avoid_: Quote Save, resave

**CRM Deal Stage**:
The sales-lifecycle position of a CRM Deal. Its first CRM Link may advance it from lead to quote; later Quote Saves do not change it, and won or lost transitions remain explicit.
_Avoid_: Quote status

## Visualization Language

**Simple Sketch**:
The editable two-dimensional layout that is the source of truth for dimensions, ClickitUp boundaries, doors, and placed outdoor products.
_Avoid_: 3D model, rendering

**3D Visualization**:
A read-only, dimensionally faithful interpretation of a Simple Sketch for quote presentation and spatial planning; it is not an installation or engineering document.
_Avoid_: 3D editor, technical drawing, installation drawing

**Visualization Plan**:
A versioned, render-neutral description derived from a Simple Sketch for constructing a 3D Visualization.
_Avoid_: Scene graph, Three.js model, 3D state

**ClickitUp Run**:
An oriented, continuous ClickitUp boundary made of an ordered sequence of sections and doors between two endpoints.
_Avoid_: Wall, edge, mesh

**ClickitUp Junction**:
The single shared physical connection at a boundary between adjacent ClickitUp members or Runs.
_Avoid_: Duplicate end, overlapping posts

**Placed Product Instance**:
One outdoor product positioned in a Simple Sketch, distinct from the product type or variant it represents.
_Avoid_: Catalog row, asset instance

**Simplified Product Model**:
A visibly distinct substitute that preserves trustworthy placement dimensions and known identity when a final visual representation is unavailable or unverified. It must not imply unknown dimensions, variants, materials, or detail.
_Avoid_: Missing product, invisible product, guessed product model

**Visualization Problem**:
A stable, user-meaningful diagnosis that part of a 3D Visualization is degraded or omitted while its source Simple Sketch remains unchanged.
_Avoid_: Exception, console error, UI message

**Visualization Quality Level**:
The degree of visual polish in a 3D Visualization, independent of the represented products, trustworthy dimensions, placements and Visualization Problems. A lower level is not itself a Simplified Product Model or an omitted product.
_Avoid_: Product accuracy, simplified sketch, missing geometry

## Warehouse Language

**Grenställ**:
Ett fysiskt BaHaMa-lagerställ med fem numrerade Våningar och två Djupplatser per Våning.
_Avoid_: Rack, hyllställ

**Våning**:
En av fem vertikala lagernivåer i ett Grenställ, numrerade nedifrån med Våning 1 längst ned.
_Avoid_: Hylla, nivå

**Djupplats**:
Den Främre platsen eller Bakre platsen på en Våning där ett enskilt parasoll kan förvaras.
_Avoid_: Position 1, position 2

**Lagerplats**:
En exakt fysisk placering som kombinerar Grenställ, Våning och Djupplats.
_Avoid_: Fritextplats, location

**Ej placerad BaHaMa-artikel**:
En lagerförd BaHaMa-artikel som saknar en igenkänd Lagerplats i det aktuella fysiska lagret.
_Avoid_: Dold artikel, borttagen artikel
