const SUPABASE_URL = 'https://oecoggegxlortfcsnagd.supabase.co';
const SUPABASE_KEY = 'SUA_KEY_AQUI';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// INIT
async function init() {
    await carregarServicos();
    await carregarEmpregos();
    await carregarFeed();
}

// ================== SERVIÇOS ==================

async function carregarServicos() {
    const { data } = await supabaseClient
        .from('services')
        .select('*')
        .limit(10);

    const container = document.getElementById('servicos-container');
    container.innerHTML = "";

    data?.forEach(s => {
        const el = document.createElement('div');
        el.className = "bg-white p-4 rounded-xl shadow mb-3";

        el.innerHTML = `
            <h3 class="font-bold text-sm">${s.title}</h3>
            <p class="text-xs text-gray-500">${s.bairro}</p>
            <button onclick="whatsapp('${s.telefone}')" 
                class="mt-2 bg-blue-600 text-white px-3 py-1 rounded text-xs">
                Falar
            </button>
        `;

        container.appendChild(el);
    });
}

// ================== EMPREGOS ==================

async function carregarEmpregos() {
    const { data } = await supabaseClient
        .from('jobs')
        .select('*')
        .limit(10);

    const container = document.getElementById('empregos-container');
    container.innerHTML = "";

    data?.forEach(j => {
        const el = document.createElement('div');
        el.className = "bg-white p-4 rounded-xl shadow mb-3";

        el.innerHTML = `
            <h3 class="font-bold text-sm">${j.title}</h3>
            <p class="text-xs text-gray-500">${j.bairro}</p>
            <button onclick="whatsapp('${j.contato}')" 
                class="mt-2 bg-green-600 text-white px-3 py-1 rounded text-xs">
                Candidatar
            </button>
        `;

        container.appendChild(el);
    });
}

// ================== FEED ==================

async function carregarFeed() {
    const { data } = await supabaseClient
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    const container = document.getElementById('feed-container');
    container.innerHTML = "";

    data?.forEach(p => {
        const el = document.createElement('div');
        el.className = "bg-white p-4 rounded-xl shadow mb-3";

        el.innerHTML = `<p class="text-sm">${p.content}</p>`;

        container.appendChild(el);
    });
}

// ================== UTIL ==================

function whatsapp(numero) {
    window.open(`https://wa.me/${numero}`, '_blank');
}

// START
window.onload = init;
