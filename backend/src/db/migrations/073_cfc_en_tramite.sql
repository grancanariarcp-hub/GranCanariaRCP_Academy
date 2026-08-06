-- Visibilidad para la Comisión CFC.
--
-- El auditor de la CFC no debe ver borradores a medio montar: solo lo que ya
-- está publicado o lo que se le marca expresamente como «en trámite de
-- acreditación», que es justamente lo que va a evaluar aunque aún no esté
-- abierto al público.
--
-- Es una casilla del curso, apagada por defecto: un curso normal no aparece
-- ante la comisión hasta publicarse.
ALTER TABLE courses ADD COLUMN IF NOT EXISTS cfc_en_tramite BOOLEAN NOT NULL DEFAULT FALSE;
