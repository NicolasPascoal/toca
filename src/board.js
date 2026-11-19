// O quadro: painel com o relatório em markdown que o agente "prega na parede".
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const panel = document.getElementById('board');
const body = panel.querySelector('.board-body');
const title = panel.querySelector('.board-title');
panel.querySelector('.board-close').addEventListener('click', hideBoard);

export function showBoard(agentName, markdown) {
  title.textContent = `Quadro · ${agentName}`;
  body.innerHTML = DOMPurify.sanitize(marked.parse(markdown));
  body.scrollTop = 0;
  panel.classList.add('open');
}

export function hideBoard() { panel.classList.remove('open'); }
export const boardOpen = () => panel.classList.contains('open');
