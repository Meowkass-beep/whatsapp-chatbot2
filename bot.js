const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");
const fs = require("fs");
const path = require("path");

let CONTADOR_TESTES = 0;
const PASTA_IMAGENS = "./imagens/";
const ARQUIVO_RELATORIO = `./relatorio${CONTADOR_TESTES}.json`;
const ATRASO_RESPOSTA = 60000;

if (!fs.existsSync(PASTA_IMAGENS)) {
  fs.mkdirSync(PASTA_IMAGENS);
}

const atraso = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const embaralharArray = (array) => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
};

const salvarRelatorio = (dados) => {
  fs.writeFileSync(ARQUIVO_RELATORIO, JSON.stringify(dados, null, 2), "utf-8");
  console.log(`relatorio salvo em: ${ARQUIVO_RELATORIO}`);
  CONTADOR_TESTES++;
};

const salvarImagem = (mensagem) => {
  return new Promise((resolve, reject) => {
    const nomeArquivo = `imagem_${Date.now()}.jpg`;
    const caminhoArquivo = path.join(PASTA_IMAGENS, nomeArquivo);

    mensagem.downloadMedia().then((media) => {
      if (!media) return reject(new Error("falha ao baixar a midia"));

      fs.writeFile(caminhoArquivo, media.data, "base64", (erro) => {
        if (erro) return reject(erro);
        resolve({ caminhoArquivo, texto: mensagem.body || null });
      });
    });
  });
};

const coletarRespostas = async (cliente, idChat) => {
  const respostas = [];
  const tempoLimite = atraso(ATRASO_RESPOSTA);

  const listener = async (mensagem) => {
    if (mensagem.from === idChat) {
      if (mensagem.type === "chat") {
        respostas.push({ tipo: "texto", conteudo: mensagem.body });
      } else if (mensagem.type === "image") {
        try {
          const imagem = await salvarImagem(mensagem);
          respostas.push({ tipo: "imagem", conteudo: imagem.caminhoArquivo, texto: imagem.texto });
        } catch (erro) {
          console.error("Erro ao salvar imagem:", erro);
        }
      }
    }
  };

  cliente.on("message", listener);
  await tempoLimite;
  cliente.removeListener("message", listener);

  return respostas;
};

const fazerPerguntas = async (cliente, chat, perguntas) => {
  const relatorio = [];
  const tempoLimitePerguntas = atraso(ATRASO_RESPOSTA);
  embaralharArray(perguntas);

  const tempoInicio = Date.now();
  let tempoPerguntaAnterior = tempoInicio;

  for (const pergunta of perguntas) {
    const tempoInicioPergunta = Date.now();

    try {
      await cliente.sendMessage(chat.id._serialized, pergunta);
      console.log(`Pergunta enviada: "${pergunta}"`);

      const respostas = await coletarRespostas(cliente, chat.id._serialized);
      console.log(`Respostas recebidas para "${pergunta}":`, respostas);

      const tempoFimPergunta = Date.now();

      relatorio.push({ pergunta, respostas, tempoInicioPergunta, tempoFimPergunta });

      const duracaoPergunta = tempoFimPergunta - tempoInicioPergunta;
      console.log(`Tempo para pergunta: ${duracaoPergunta}ms`);

      const tempoDesdeUltimaPergunta = tempoInicioPergunta - tempoPerguntaAnterior;
      console.log(`Tempo desde última pergunta: ${tempoDesdeUltimaPergunta}ms`);

      tempoPerguntaAnterior = tempoInicioPergunta;
    } catch (erro) {
      console.error(`Erro com a pergunta "${pergunta}":`, erro);
      relatorio.push({ pergunta, respostas: [{ tipo: "texto", conteudo: "Erro ao coletar respostas" }] });
    }

    await tempoLimitePerguntas;
  }

  const tempoFim = Date.now();
  const duracaoTotal = tempoFim - tempoInicio;
  console.log(`Tempo total: ${duracaoTotal}ms`);

  salvarRelatorio(relatorio);
};

const cliente = new Client({ authStrategy: new LocalAuth() });

cliente.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
});

cliente.on("ready", async () => {
  console.log("cliente pronto!");

  setTimeout(async () => {
    try {
      const chats = await cliente.getChats();
      const numeroTedi = "5511935025295";
      const chatTedi = chats.find((chat) => chat.id._serialized === `${numeroTedi}@c.us`);

      if (chatTedi) {
        const perguntas = [
          "Quais são os ingredientes de uma pizza Margherita?",
          "Como faço um bolo de chocolate?",
          "Qual a receita para spaghetti aglio e olio?",
          "Qual a melhor forma de cozinhar salmão?",
          "Como faço uma lasanha vegetariana?",
          "Qual a receita para fazer pão caseiro?",
          "Como preparo um risoto de camarão?",
          "Quais os ingredientes de uma feijoada completa?",
          "Como faço um estrogonofe de frango?",
          "Qual a receita de um smoothie de frutas tropicais?",
        ];

        await fazerPerguntas(cliente, chatTedi, perguntas);
      } else {
        console.log("chat com o Tedi não encontrado");
      }
    } catch (erro) {
      console.error("erro ao buscar chats:", erro);
    }
  }, 5000);
});

cliente.initialize();