/* La voz del gemelo, en el navegador.

   El modelo de lenguaje corre en el navegador de quien consulta, con WebGPU y WebLLM, y no
   hay servidor. Hace dos cosas y ninguna produce un numero: elige cual de las consultas
   permitidas corresponde a la pregunta, y redacta la respuesta con los datos que devolvio
   esa consulta. Despues la validacion descarta el texto si trae un numero que no esta en
   esos datos, y en ese caso se muestra la respuesta armada.

   validar() es la misma regla que malla/voz/validar.py, y PU-14 comprueba que las dos den
   lo mismo sobre los mismos casos. */

(function (raiz) {
  "use strict";

  var NO_SE = "No lo sé. La respuesta traía un número que no calculó el sistema.";

  // punto de miles y coma decimal. Un numero pegado a una letra es parte de un identificador
  var NUMERO = /(?<![\p{L}\p{N}_.,])(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?(?![\p{L}\p{N}_])/gu;

  function numeros(texto) {
    var r = [], m;
    NUMERO.lastIndex = 0;
    while ((m = NUMERO.exec(texto)) !== null) {
      var dec = m[2] || "";
      r.push({ valor: parseFloat(m[1].replace(/\./g, "") + "." + (dec || "0")), decimales: dec.length });
    }
    return r;
  }

  function registrado(x, decimales, valores) {
    var margen = 0.5 * Math.pow(10, -decimales) + 1e-9;
    return valores.some(function (v) { return Math.abs(v - x) <= margen; });
  }

  function validar(texto, valores) {
    var sobran = numeros(texto).filter(function (n) {
      return !registrado(n.valor, n.decimales, valores);
    }).map(function (n) { return n.valor; });
    if (sobran.length) return { ok: false, texto: NO_SE, sobran: sobran };
    return { ok: true, texto: texto, sobran: [] };
  }

  /* La otra mitad del control, que validar.py no tiene porque alli la consulta se arma en
     el servidor: la redaccion tambien se descarta si le falta un numero clave de la
     consulta. Asi no pasa un texto sin numeros falsos pero que no contesta nada. */
  function completo(texto, claves) {
    var hay = numeros(texto);
    var faltan = claves.filter(function (c) {
      return !hay.some(function (n) { return registrado(n.valor, c.decimales, [c.valor]); });
    }).map(function (c) { return c.valor; });
    return { ok: faltan.length === 0, faltan: faltan };
  }

  /* Clasificador de respaldo, por palabras clave. Se usa cuando no hay modelo, y cuando
     el modelo contesta algo que no es una de las etiquetas. */
  var CLAVES = [
    ["corte", /cort|romp|rot[oa]|falla|sin gas|aguas abajo|queda|afect|sale de servicio/],
    ["cobertura", /jornada|cuadrilla|cubr|cobertura|presupuesto|horas/],
    ["encabeza", /encabez|primer|por qu[eé]|m[aá]s cr[ií]tico|peligros|riesgos[oa]|prioridad|cola/],
    ["adelantar", /adelant|cu[aá]ndo|invierno|estacion|mes|venc/],
    ["concentracion", /concentr|cr[ií]ticos|porcentaje del riesgo/],
    ["limites", /no puede|l[ií]mite|fuga|no sabe|dato/]
  ];

  function clasificarPorClaves(pregunta) {
    var p = pregunta.toLowerCase();
    for (var i = 0; i < CLAVES.length; i++) if (CLAVES[i][1].test(p)) return CLAVES[i][0];
    return "limites";
  }

  /* ---------- el modelo ---------- */

  var WEBLLM = "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.85/+esm";
  var motor = null;
  var modelo = null;

  function hayWebGPU() { return typeof navigator !== "undefined" && !!navigator.gpu; }

  async function cargar(progreso) {
    if (motor) return modelo;
    var adaptador = await navigator.gpu.requestAdapter();
    if (!adaptador) throw new Error("el navegador no expone una placa de video");
    // la variante f16 pesa menos, pero no todas las placas la soportan
    modelo = adaptador.features.has("shader-f16") ? "Qwen3-1.7B-q4f16_1-MLC" : "Qwen3-1.7B-q4f32_1-MLC";
    var webllm = await import(WEBLLM);
    motor = await webllm.CreateMLCEngine(modelo, {
      initProgressCallback: function (r) { if (progreso) progreso(r.progress || 0, r.text || ""); }
    });
    return modelo;
  }

  function limpiar(texto) {
    return (texto || "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  }

  async function llamar(sistema, usuario, maximo) {
    var r = await motor.chat.completions.create({
      messages: [{ role: "system", content: sistema }, { role: "user", content: usuario }],
      temperature: 0,
      max_tokens: maximo,
      extra_body: { enable_thinking: false }
    });
    return limpiar(r.choices[0].message.content);
  }

  async function elegir(pregunta, etiquetas) {
    var sistema = "Clasificás preguntas sobre una red de distribución de gas. Contestá solo con " +
      "una de estas etiquetas, sin nada más:\n" +
      etiquetas.map(function (e) { return e[0] + ": " + e[1]; }).join("\n") +
      "\n\nEjemplos:\n" +
      "¿Qué pasa si se rompe el caño de la calle Mitre? corte\n" +
      "¿Por qué ese tramo es el primero de la lista? encabeza\n" +
      "¿Cuánto cubro con 3 cuadrillas? cobertura\n" +
      "¿Qué parte del riesgo está en los peores tramos? concentracion\n" +
      "¿En qué época conviene inspeccionar? adelantar\n" +
      "¿Dónde hay una fuga? limites";
    var r = (await llamar(sistema, pregunta, 12)).toLowerCase();
    for (var i = 0; i < etiquetas.length; i++) if (r.indexOf(etiquetas[i][0]) !== -1) return etiquetas[i][0];
    return null;
  }

  async function redactar(pregunta, hechos) {
    var sistema = "Sos la voz de Malla, el gemelo digital de una red de gas. Respondé la " +
      "pregunta en castellano rioplatense, en dos o tres oraciones, usando solo los datos que " +
      "te paso. Copiá cada número tal como está escrito. No agregues ningún número, fecha ni " +
      "porcentaje que no esté en los datos, y no dejes afuera ninguno de los que están. Cada " +
      "número va con las mismas palabras que lo acompañan en los datos. No agregues causas, " +
      "adjetivos ni consejos que no estén en los datos. No uses listas ni formato.";
    return llamar(sistema, "Pregunta: " + pregunta + "\n\nDatos:\n" + hechos, 200);
  }

  var api = {
    NO_SE: NO_SE, numeros: numeros, validar: validar, completo: completo,
    clasificarPorClaves: clasificarPorClaves,
    hayWebGPU: hayWebGPU, cargar: cargar, elegir: elegir, redactar: redactar,
    lista: function () { return !!motor; }
  };
  raiz.MallaVoz = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : this);
