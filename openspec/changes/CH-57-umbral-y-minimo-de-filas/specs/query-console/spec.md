# Query Console Specification (CH-57 delta)

DEC-209 applied to the console: the template editor writes the parameter texts, and the automation forms read them. The query editor and the client panel do not change.

## ADDED Requirements

### Requirement: Template Editor Writes Parameter Texts (DEC-209)
In the template editor (section 2 «Datos»), each parameter row SHALL hold, after «Nombre» and «Tipo», two optional inputs: «Rótulo para el operador» (max 60) and «Ayuda» (max 240).
- The save body SHALL send each entry with the texts that are not blank.
- The texts SHALL count as unsaved changes.
- The texts SHALL NOT be part of the test fingerprint: changing only a text keeps a passing test valid. The fingerprint keeps `nombre` and `tipo`.
- Opening a template to edit SHALL fill the texts. «Duplicar y editar» SHALL keep them.
- The query editor's parameter rows SHALL NOT get these inputs.

#### Scenario: A label change keeps the test valid
- GIVEN a template whose last test passed
- WHEN the operator types a «Rótulo para el operador» for its parameter
- THEN «Guardar plantilla» SHALL stay enabled, and the editor SHALL report unsaved changes

#### Scenario: A copy keeps the texts
- GIVEN a template in use whose `umbral` has a label and a help text
- WHEN the operator uses «Duplicar y editar»
- THEN the copy's parameter row SHALL hold the same label and help, while its client title and description start empty (DEC-191)

### Requirement: Automation Parameter Labels (C-13, DEC-209)
In the automation create form and the adjust pop-up, each template parameter SHALL be labeled, in this order of precedence:
1. by the declaration's `etiqueta`, with its `ayuda` if any;
2. by the console's fixed map for the built-in templates (`stock-fisico` and `stock-producible`, parameter `umbral`), with its help;
3. by the parameter's `nombre`, with no help.

A help text SHALL be linked to its control with `aria-describedby`. The request SHALL still send the value under the parameter's `nombre`.

#### Scenario: A console-written template is labeled by its declaration
- GIVEN a template with `parametros: [{nombre:"umbral", tipo:"numero", etiqueta:"Stock mínimo", ayuda:"Avisa con esta cantidad o menos."}]`
- WHEN it is chosen in the create form
- THEN the parameter control SHALL be labeled «Stock mínimo» and described by that help

#### Scenario: A seeded template keeps its fixed label
- GIVEN the seeded `stock-fisico` template, whose declaration has no texts
- WHEN it is chosen in the create form
- THEN the control SHALL be labeled «Stock mínimo por producto»

#### Scenario: A template with no texts shows the name
- GIVEN a template outside the fixed map, with no texts
- WHEN it is chosen
- THEN the control SHALL be labeled with the parameter's `nombre`, with no help

### Requirement: Minimum Rows Help on Both Forms and Channels (DEC-186, DEC-209)
The «Mínimo de filas para avisar» field SHALL carry a help text in the create form (`auto-minimo-ayuda`) and in the adjust pop-up (`aj-minimo-ayuda`), linked with `aria-describedby`.
- For email: «El correo sale solo si la consulta devuelve al menos esta cantidad de filas. Es cuántos productos tienen que cumplir la condición, no el valor de la condición: con 3, solo avisa cuando hay 3 o más productos.»
- For Telegram: the same text, starting «El mensaje sale solo si…».
- A channel change SHALL swap between the two texts and SHALL keep the second sentence.

#### Scenario: The explanation survives a channel change
- GIVEN the create form
- WHEN the channel is switched to Telegram and back to email
- THEN `auto-minimo-ayuda` SHALL still contain «no el valor de la condición»

#### Scenario: The adjust pop-up explains the minimum
- GIVEN an automation on the Telegram channel
- WHEN its adjust pop-up opens
- THEN `aj-minimo` SHALL be described by `aj-minimo-ayuda`, starting «El mensaje sale solo si»
