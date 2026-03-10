"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { UserPlus, ArrowRight, CheckCircle2 } from "lucide-react";

// Tipo para ajudar o TypeScript a entender nossos dados
type Pedido = {
  id: string;
  nome_aluno: string;
  status: string;
  hora_pedido: string;
};

export default function Home() {
  const [fila, setFila] = useState<Pedido[]>([]);
  const [nome, setNome] = useState("");

  // Efeito para carregar a fila quando a página abre e ouvir mudanças em tempo real
  useEffect(() => {
    carregarFila();

    const channel = supabase
      .channel("realtime_fila")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "fila_banheiro" },
        () => {
          carregarFila(); // Recarrega a tela sempre que o banco atualizar
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Busca os dados no Supabase (ignorando quem já concluiu)
  const carregarFila = async () => {
    const { data } = await supabase
      .from("fila_banheiro")
      .select("*")
      .neq("status", "concluido")
      .order("hora_pedido", { ascending: true });

    if (data) setFila(data);
  };

  // Função para adicionar aluno na fila
  const entrarNaFila = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) return;

    // Se não tiver ninguém na fila, já entra com status 'no_banheiro', senão fica 'esperando'
    const statusInicial = fila.length === 0 ? "no_banheiro" : "esperando";
    const horaSaida = fila.length === 0 ? new Date().toISOString() : null;

    await supabase.from("fila_banheiro").insert([
      {
        nome_aluno: nome,
        status: statusInicial,
        hora_saida: horaSaida,
      },
    ]);

    setNome(""); // Limpa o campo de texto
  };

  // Função para quando o aluno volta do banheiro
  const registrarVolta = async (id: string) => {
    // 1. Marca quem voltou como 'concluido'
    await supabase
      .from("fila_banheiro")
      .update({ status: "concluido", hora_volta: new Date().toISOString() })
      .eq("id", id);

    // 2. Acha quem é o próximo da fila para liberar a vez
    const proximo = fila.find((p) => p.status === "esperando" && p.id !== id);
    if (proximo) {
      await supabase
        .from("fila_banheiro")
        .update({ status: "no_banheiro", hora_saida: new Date().toISOString() })
        .eq("id", proximo.id);
    }
  };

  const noBanheiro = fila.find((p) => p.status === "no_banheiro");
  const esperando = fila.filter((p) => p.status === "esperando");

  return (
    <main className="min-h-screen bg-gray-50 p-6 font-sans text-gray-800">
      <div className="max-w-xl mx-auto space-y-8">
        
        {/* Cabeçalho */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-blue-600">Fila do Banheiro 🚽</h1>
          <p className="text-gray-500 mt-2">Coloque seu nome e aguarde a sua vez.</p>
        </div>

        {/* Formulário para entrar na fila */}
        <form onSubmit={entrarNaFila} className="flex gap-2 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <input
            type="text"
            placeholder="Digite seu nome..."
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 font-medium transition-colors"
          >
            <UserPlus size={20} />
            Entrar
          </button>
        </form>

        {/* Status Atual - Quem está no banheiro */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-blue-50 px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-blue-800 flex items-center gap-2">
              <ArrowRight size={20} />
              No Banheiro Agora
            </h2>
          </div>
          <div className="p-6">
            {noBanheiro ? (
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-gray-800">{noBanheiro.nome_aluno}</span>
                <button
                  onClick={() => registrarVolta(noBanheiro.id)}
                  className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 flex items-center gap-2 transition-colors shadow-sm"
                >
                  <CheckCircle2 size={20} />
                  Voltei!
                </button>
              </div>
            ) : (
              <p className="text-gray-400 text-center italic">Banheiro livre!</p>
            )}
          </div>
        </div>

        {/* Fila de Espera */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-700">Fila de Espera ({esperando.length})</h2>
          </div>
          <ul className="divide-y divide-gray-100">
            {esperando.length > 0 ? (
              esperando.map((pedido, index) => (
                <li key={pedido.id} className="px-6 py-4 flex items-center gap-4">
                  <span className="bg-gray-100 text-gray-500 font-bold rounded-full w-8 h-8 flex items-center justify-center shrink-0">
                    {index + 1}
                  </span>
                  <span className="text-lg text-gray-700">{pedido.nome_aluno}</span>
                </li>
              ))
            ) : (
              <li className="px-6 py-8 text-center text-gray-400 italic">
                Ninguém na fila de espera no momento.
              </li>
            )}
          </ul>
        </div>

      </div>
    </main>
  );
}