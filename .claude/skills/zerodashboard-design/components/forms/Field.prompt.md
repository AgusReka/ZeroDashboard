Campo con etiqueta visible siempre asociada (for/id), texto de ayuda y error legible; usalo para todo input del sistema.

```jsx
<Field label="Avisarme cuando queden menos de" type="number" suffix="unidades" defaultValue={20} help="Rige desde la próxima ejecución." />
<Field label="Hora de envío" as="select"><option>08:00</option><option>12:00</option></Field>
<Field label="Consulta" as="textarea" mono rows={8} error="Solo se permiten consultas de lectura (SELECT)." />
```

Nunca uses placeholder como etiqueta. `mono` es exclusivo de la consola.
