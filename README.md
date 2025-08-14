# Daily Open Source Learning

Automatiza **commits diarios útiles** que documentan tu aprendizaje: palabra en inglés, tip de IA y mini-reto de código.
Todo se guarda en [`data/log.md`](data/log.md) y se actualiza automáticamente con **GitHub Actions**.

## ¿Qué hace?
- 📗 **English word of the day** (con ejemplo)
- 🤖 **AI tip** corto y accionable
- 💻 **Coding prompt** (reto breve)

## Cómo usarlo
1. Crea un nuevo repositorio en GitHub (público o privado).
2. Sube estos archivos (o usa `git push`).
3. Habilita GitHub Actions (está activado por defecto en repos públicos).
4. ¡Listo! El workflow corre todos los días y hace commit si hay cambios.

> Puedes editar los contenidos en `data/*.json` para personalizar tu aprendizaje.

## Ejecutar localmente
```bash
node scripts/update.js
git add .
git commit -m "chore(daily): update log"
```


> Última actualización automática: 2025-08-14

---

### Licencia
MIT
