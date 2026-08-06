--
-- PostgreSQL database dump
--

\restrict 9u1ueRZu4bnZquGNPYjAYO7OUD562DTi80XsORAXedzbUeNZNq8e8e0i238cFAX

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

-- Started on 2026-07-08 23:19:06

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 2 (class 3079 OID 16389)
-- Name: postgis; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;


--
-- TOC entry 5984 (class 0 OID 0)
-- Dependencies: 2
-- Name: EXTENSION postgis; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION postgis IS 'PostGIS geometry and geography spatial types and functions';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 228 (class 1259 OID 17574)
-- Name: aree; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.aree (
    id integer NOT NULL,
    nome character varying(100) NOT NULL,
    confini public.geometry(Polygon,4326) NOT NULL,
    data_creazione timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.aree OWNER TO postgres;

--
-- TOC entry 227 (class 1259 OID 17573)
-- Name: aree_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.aree_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.aree_id_seq OWNER TO postgres;

--
-- TOC entry 5985 (class 0 OID 0)
-- Dependencies: 227
-- Name: aree_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.aree_id_seq OWNED BY public.aree.id;


--
-- TOC entry 234 (class 1259 OID 17614)
-- Name: immagini; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.immagini (
    id integer NOT NULL,
    id_punto integer NOT NULL,
    percorso_file character varying(255) NOT NULL,
    data_ora timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.immagini OWNER TO postgres;

--
-- TOC entry 233 (class 1259 OID 17613)
-- Name: immagini_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.immagini_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.immagini_id_seq OWNER TO postgres;

--
-- TOC entry 5986 (class 0 OID 0)
-- Dependencies: 233
-- Name: immagini_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.immagini_id_seq OWNED BY public.immagini.id;


--
-- TOC entry 232 (class 1259 OID 17598)
-- Name: misurazioni; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.misurazioni (
    id integer NOT NULL,
    id_punto integer NOT NULL,
    temperatura numeric(4,2) NOT NULL,
    data_ora timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.misurazioni OWNER TO postgres;

--
-- TOC entry 231 (class 1259 OID 17597)
-- Name: misurazioni_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.misurazioni_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.misurazioni_id_seq OWNER TO postgres;

--
-- TOC entry 5987 (class 0 OID 0)
-- Dependencies: 231
-- Name: misurazioni_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.misurazioni_id_seq OWNED BY public.misurazioni.id;


--
-- TOC entry 230 (class 1259 OID 17587)
-- Name: punti; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.punti (
    id integer NOT NULL,
    posizione public.geometry(Point,4326) NOT NULL
);


ALTER TABLE public.punti OWNER TO postgres;

--
-- TOC entry 229 (class 1259 OID 17586)
-- Name: punti_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.punti_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.punti_id_seq OWNER TO postgres;

--
-- TOC entry 5988 (class 0 OID 0)
-- Dependencies: 229
-- Name: punti_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.punti_id_seq OWNED BY public.punti.id;


--
-- TOC entry 226 (class 1259 OID 17501)
-- Name: punti_ricognizione; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.punti_ricognizione (
    id integer NOT NULL,
    temperatura numeric(4,1),
    data_misurazione date DEFAULT CURRENT_DATE,
    ora_misurazione time without time zone DEFAULT CURRENT_TIME,
    zona_foto_url text,
    posizione public.geometry(Point,4326),
    geohash character varying(12)
);


ALTER TABLE public.punti_ricognizione OWNER TO postgres;

--
-- TOC entry 225 (class 1259 OID 17500)
-- Name: punti_ricognizione_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.punti_ricognizione_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.punti_ricognizione_id_seq OWNER TO postgres;

--
-- TOC entry 5989 (class 0 OID 0)
-- Dependencies: 225
-- Name: punti_ricognizione_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.punti_ricognizione_id_seq OWNED BY public.punti_ricognizione.id;


--
-- TOC entry 5792 (class 2604 OID 17577)
-- Name: aree id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.aree ALTER COLUMN id SET DEFAULT nextval('public.aree_id_seq'::regclass);


--
-- TOC entry 5797 (class 2604 OID 17617)
-- Name: immagini id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.immagini ALTER COLUMN id SET DEFAULT nextval('public.immagini_id_seq'::regclass);


--
-- TOC entry 5795 (class 2604 OID 17601)
-- Name: misurazioni id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.misurazioni ALTER COLUMN id SET DEFAULT nextval('public.misurazioni_id_seq'::regclass);


--
-- TOC entry 5794 (class 2604 OID 17590)
-- Name: punti id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.punti ALTER COLUMN id SET DEFAULT nextval('public.punti_id_seq'::regclass);


--
-- TOC entry 5789 (class 2604 OID 17504)
-- Name: punti_ricognizione id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.punti_ricognizione ALTER COLUMN id SET DEFAULT nextval('public.punti_ricognizione_id_seq'::regclass);


--
-- TOC entry 5972 (class 0 OID 17574)
-- Dependencies: 228
-- Data for Name: aree; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.aree (id, nome, confini, data_creazione) FROM stdin;
1	Area Alfa - Zona Nord	0103000020E6100000010000000500000057CF49EF1BFF2540FAB836548CB346401EA7E8482EFF25408811C2A38DB346405709168733FF25406B60AB048BB346401E8A027D22FF254001DE02098AB3464057CF49EF1BFF2540FAB836548CB34640	2026-07-01 18:22:02.243482
2	Area Beta - Zona Sud	0103000020E6100000010000000500000073637AC212FF2540EB6E9EEA90B34640ACE28DCC23FF254056F146E691B34640739D465A2AFF25405D16139B8FB34640ACC5A70018FF2540F3936A9F8EB3464073637AC212FF2540EB6E9EEA90B34640	2026-07-01 18:22:02.243482
\.


--
-- TOC entry 5978 (class 0 OID 17614)
-- Dependencies: 234
-- Data for Name: immagini; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.immagini (id, id_punto, percorso_file, data_ora) FROM stdin;
1	1	immagini/immagine1.jpg	2026-06-15 09:34:12
2	2	immagini/immagine2.jpg	2026-06-15 10:12:45
3	3	immagini/immagine3.jpg	2026-06-16 14:22:01
4	4	immagini/immagine4.jpg	2026-06-16 16:05:30
\.


--
-- TOC entry 5976 (class 0 OID 17598)
-- Dependencies: 232
-- Data for Name: misurazioni; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.misurazioni (id, id_punto, temperatura, data_ora) FROM stdin;
1	1	23.50	2026-07-01 10:00:00
2	1	24.10	2026-07-01 10:15:00
3	2	24.80	2026-07-01 10:16:00
4	3	19.20	2026-07-01 11:00:00
5	4	19.50	2026-07-01 11:05:00
8	5	24.50	2026-07-01 14:32:00
9	6	25.20	2026-07-01 14:33:15
10	7	30.20	2026-06-15 14:30:00
\.


--
-- TOC entry 5974 (class 0 OID 17587)
-- Dependencies: 230
-- Data for Name: punti; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.punti (id, posizione) FROM stdin;
1	0101000020E61000003A3B191C25FF2540B30C71AC8BB34640
2	0101000020E610000001F6D1A92BFF25401D8F19A88CB34640
3	0101000020E6100000C976BE9F1AFF2540A4C2D84290B34640
4	0101000020E61000009031772D21FF2540C898BB9690B34640
5	0101000020E6100000384E0AF31EFF25403A747ADE8DB34640
6	0101000020E61000004B72C0AE26FF25408ECEF9298EB34640
7	0101000020E61000002FC1A90F24FF2540290989B48DB34640
\.


--
-- TOC entry 5970 (class 0 OID 17501)
-- Dependencies: 226
-- Data for Name: punti_ricognizione; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.punti_ricognizione (id, temperatura, data_misurazione, ora_misurazione, zona_foto_url, posizione, geohash) FROM stdin;
1	22.5	2026-04-25	09:30:00	https://images.unsplash.com/photo-1501004318641-b39e6451bec6?w=600	0101000020E6100000355EBA490C0226409A99999999B14640	u0pf4qsc7g1p
2	19.8	2026-04-18	07:15:00	https://images.unsplash.com/photo-1463936575829-25148e1db1b8?w=600	0101000020E6100000355EBA490C0226409A99999999B14640	u0pf4qsc7g1p
3	26.4	2026-05-10	14:00:00	https://images.unsplash.com/photo-1530595467537-0b5996c41f2d?w=600	0101000020E6100000355EBA490C0226409A99999999B14640	u0pf4qsc7g1p
4	23.1	2026-05-02	14:15:00	https://images.unsplash.com/photo-1520302849574-5bfc1e32157b?w=600	0101000020E6100000C3F5285C8F0226408B6CE7FBA9B14640	u0pf4qts706y
5	21.0	2026-04-29	10:30:00	https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=600	0101000020E6100000C3F5285C8F0226408B6CE7FBA9B14640	u0pf4qts706y
6	21.8	2026-05-09	08:45:00	https://images.unsplash.com/photo-1534710951216-443e4e7d9888?w=600	0101000020E6100000A8C64B3789012640C520B07268B14640	u0pf4qk0s7x7
7	25.5	2026-05-20	17:45:00	https://images.unsplash.com/photo-1473448912268-2022ce9509d8?w=600	0101000020E6100000A8C64B3789012640C520B07268B14640	u0pf4qk0s7x7
8	24.0	2026-05-15	18:20:00	https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=600	0101000020E61000001B2FDD240601264060E5D022DBB14640	u0pf4qgmj0jf
9	22.0	2026-05-22	11:05:00	https://images.unsplash.com/photo-1448375240586-882707db888b?w=600	0101000020E6100000508D976E12032640E17A14AE47B14640	u0pf4qn6f3hq
10	25.2	2026-05-24	13:40:00	https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?w=600	0101000020E610000085EB51B81E0526401904560E2DB24640	u0pf4x35xd55
11	20.2	2026-05-01	09:00:00	https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=600	0101000020E610000085EB51B81E0526401904560E2DB24640	u0pf4x35xd55
12	25.7	2026-05-27	16:10:00	https://images.unsplash.com/photo-1507511616658-9a133f91ba63?w=600	0101000020E6100000A01A2FDD24062640EE7C3F355EB24640	u0pf4xdsq1wq
\.


--
-- TOC entry 5788 (class 0 OID 16708)
-- Dependencies: 221
-- Data for Name: spatial_ref_sys; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.spatial_ref_sys (srid, auth_name, auth_srid, srtext, proj4text) FROM stdin;
\.


--
-- TOC entry 5990 (class 0 OID 0)
-- Dependencies: 227
-- Name: aree_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.aree_id_seq', 2, true);


--
-- TOC entry 5991 (class 0 OID 0)
-- Dependencies: 233
-- Name: immagini_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.immagini_id_seq', 4, true);


--
-- TOC entry 5992 (class 0 OID 0)
-- Dependencies: 231
-- Name: misurazioni_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.misurazioni_id_seq', 11, true);


--
-- TOC entry 5993 (class 0 OID 0)
-- Dependencies: 229
-- Name: punti_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.punti_id_seq', 8, true);


--
-- TOC entry 5994 (class 0 OID 0)
-- Dependencies: 225
-- Name: punti_ricognizione_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.punti_ricognizione_id_seq', 12, true);


--
-- TOC entry 5806 (class 2606 OID 17585)
-- Name: aree aree_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.aree
    ADD CONSTRAINT aree_pkey PRIMARY KEY (id);


--
-- TOC entry 5814 (class 2606 OID 17623)
-- Name: immagini immagini_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.immagini
    ADD CONSTRAINT immagini_pkey PRIMARY KEY (id);


--
-- TOC entry 5812 (class 2606 OID 17607)
-- Name: misurazioni misurazioni_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.misurazioni
    ADD CONSTRAINT misurazioni_pkey PRIMARY KEY (id);


--
-- TOC entry 5810 (class 2606 OID 17596)
-- Name: punti punti_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.punti
    ADD CONSTRAINT punti_pkey PRIMARY KEY (id);


--
-- TOC entry 5804 (class 2606 OID 17511)
-- Name: punti_ricognizione punti_ricognizione_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.punti_ricognizione
    ADD CONSTRAINT punti_ricognizione_pkey PRIMARY KEY (id);


--
-- TOC entry 5807 (class 1259 OID 17629)
-- Name: idx_aree_confini; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_aree_confini ON public.aree USING gist (confini);


--
-- TOC entry 5802 (class 1259 OID 17565)
-- Name: idx_geohash; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_geohash ON public.punti_ricognizione USING btree (geohash);


--
-- TOC entry 5808 (class 1259 OID 17630)
-- Name: idx_punti_posizione; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_punti_posizione ON public.punti USING gist (posizione);


--
-- TOC entry 5816 (class 2606 OID 17624)
-- Name: immagini immagini_id_punto_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.immagini
    ADD CONSTRAINT immagini_id_punto_fkey FOREIGN KEY (id_punto) REFERENCES public.punti(id) ON DELETE CASCADE;


--
-- TOC entry 5815 (class 2606 OID 17608)
-- Name: misurazioni misurazioni_id_punto_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.misurazioni
    ADD CONSTRAINT misurazioni_id_punto_fkey FOREIGN KEY (id_punto) REFERENCES public.punti(id) ON DELETE CASCADE;


-- Completed on 2026-07-08 23:19:06

--
-- PostgreSQL database dump complete
--

\unrestrict 9u1ueRZu4bnZquGNPYjAYO7OUD562DTi80XsORAXedzbUeNZNq8e8e0i238cFAX

