-- CH-31 (DEC-170): schema and data of food_store, a fictional database from the owner's
-- university project, dumped on 2026-10-13 with pg_dump --no-owner --no-privileges.
-- The rows of "user" and direccion were replaced by neutral values before versioning: the
-- hashes are inert and match no password. The five v_* views are the canonical-contract
-- mapping of CH-16. Loaded once by the replica-demo service on an empty volume.

--
-- PostgreSQL database dump
--

\restrict fRoPiCGV4dOdAQR5Ml2SmV6r7cK8zN1fYrafSZFx3cYdGUQHYrRdgJkgrREWxbd

-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: estado_pedido_codigo; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.estado_pedido_codigo AS ENUM (
    'PENDIENTE',
    'CONFIRMADO',
    'EN_PREP',
    'LISTO',
    'ENTREGADO',
    'CANCELADO'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: category; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.category (
    id integer NOT NULL,
    parent_id integer,
    name character varying(100) NOT NULL,
    description character varying,
    image_url character varying,
    order_display integer NOT NULL,
    is_active boolean NOT NULL,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL,
    deleted_at timestamp without time zone
);


--
-- Name: category_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.category_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: category_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.category_id_seq OWNED BY public.category.id;


--
-- Name: detalle_pedido; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.detalle_pedido (
    id integer NOT NULL,
    pedido_id integer NOT NULL,
    producto_id integer NOT NULL,
    producto_nombre character varying(200) NOT NULL,
    producto_precio_unitario numeric(10,2) NOT NULL,
    cantidad integer NOT NULL,
    subtotal numeric(10,2) NOT NULL,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL,
    deleted_at timestamp without time zone
);


--
-- Name: detalle_pedido_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.detalle_pedido_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: detalle_pedido_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.detalle_pedido_id_seq OWNED BY public.detalle_pedido.id;


--
-- Name: direccion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.direccion (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    alias character varying(50) NOT NULL,
    calle character varying(100) NOT NULL,
    numero character varying(20) NOT NULL,
    piso_dpto character varying(20),
    ciudad character varying(50) NOT NULL,
    provincia character varying(50) NOT NULL,
    codigo_postal character varying(20),
    latitud double precision,
    longitud double precision,
    es_principal boolean NOT NULL,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL,
    deleted_at timestamp without time zone
);


--
-- Name: direccion_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.direccion_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: direccion_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.direccion_id_seq OWNED BY public.direccion.id;


--
-- Name: estado_pedido; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.estado_pedido (
    id integer NOT NULL,
    codigo public.estado_pedido_codigo NOT NULL,
    descripcion character varying(200) NOT NULL,
    orden integer NOT NULL,
    created_at timestamp without time zone NOT NULL
);


--
-- Name: estado_pedido_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.estado_pedido_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: estado_pedido_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.estado_pedido_id_seq OWNED BY public.estado_pedido.id;


--
-- Name: forma_pago; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.forma_pago (
    id integer NOT NULL,
    nombre character varying(50) NOT NULL,
    descripcion character varying(200),
    requiere_monto_pago boolean NOT NULL,
    is_active boolean NOT NULL,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL,
    deleted_at timestamp without time zone
);


--
-- Name: forma_pago_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.forma_pago_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: forma_pago_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.forma_pago_id_seq OWNED BY public.forma_pago.id;


--
-- Name: historial_estado_pedido; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.historial_estado_pedido (
    id integer NOT NULL,
    pedido_id integer NOT NULL,
    estado_id integer NOT NULL,
    usuario_cambio_id integer,
    observaciones character varying(200),
    created_at timestamp without time zone NOT NULL
);


--
-- Name: historial_estado_pedido_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.historial_estado_pedido_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: historial_estado_pedido_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.historial_estado_pedido_id_seq OWNED BY public.historial_estado_pedido.id;


--
-- Name: images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.images (
    id integer NOT NULL,
    public_id character varying(500) NOT NULL,
    url character varying(1000) NOT NULL,
    filename character varying(255) NOT NULL,
    format character varying(20),
    width integer,
    height integer,
    bytes integer,
    created_at timestamp without time zone NOT NULL
);


--
-- Name: images_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.images_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: images_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.images_id_seq OWNED BY public.images.id;


--
-- Name: ingredient; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ingredient (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    description character varying,
    stock_quantity integer NOT NULL,
    is_allergen boolean NOT NULL,
    is_active boolean NOT NULL,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL,
    deleted_at timestamp without time zone
);


--
-- Name: ingredient_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.ingredient_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: ingredient_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.ingredient_id_seq OWNED BY public.ingredient.id;


--
-- Name: pagos_mp; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pagos_mp (
    id integer NOT NULL,
    pedido_id integer,
    mp_payment_id bigint,
    mp_status character varying(30) NOT NULL,
    mp_status_detail character varying(100),
    transaction_amount numeric(10,2) NOT NULL,
    external_reference character varying(100) NOT NULL,
    idempotency_key character varying(100) NOT NULL,
    checkout_data text,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL
);


--
-- Name: pagos_mp_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pagos_mp_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pagos_mp_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pagos_mp_id_seq OWNED BY public.pagos_mp.id;


--
-- Name: pedido; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pedido (
    id integer NOT NULL,
    usuario_id integer NOT NULL,
    direccion_entrega_id integer NOT NULL,
    forma_pago_id integer NOT NULL,
    estado_id integer NOT NULL,
    subtotal numeric(10,2) NOT NULL,
    costo_envio numeric(10,2),
    total numeric(10,2) NOT NULL,
    notas_cliente character varying(200),
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL,
    deleted_at timestamp without time zone
);


--
-- Name: pedido_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.pedido_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: pedido_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.pedido_id_seq OWNED BY public.pedido.id;


--
-- Name: product; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product (
    id integer NOT NULL,
    name character varying(150) NOT NULL,
    description character varying,
    base_price numeric(10,2) NOT NULL,
    image_urls text[],
    stock_quantity integer NOT NULL,
    prep_time_min integer,
    available boolean NOT NULL,
    created_at timestamp without time zone NOT NULL,
    updated_at timestamp without time zone NOT NULL,
    deleted_at timestamp without time zone
);


--
-- Name: product_category; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_category (
    product_id integer NOT NULL,
    category_id integer NOT NULL,
    is_primary boolean NOT NULL,
    created_at timestamp without time zone NOT NULL
);


--
-- Name: product_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.product_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: product_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.product_id_seq OWNED BY public.product.id;


--
-- Name: product_ingredient; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.product_ingredient (
    product_id integer NOT NULL,
    ingredient_id integer NOT NULL,
    is_removable boolean NOT NULL,
    quantity integer NOT NULL,
    created_at timestamp without time zone NOT NULL
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    code character varying(20) NOT NULL,
    name character varying(50) NOT NULL,
    description character varying
);


--
-- Name: transicion_estado; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transicion_estado (
    id integer NOT NULL,
    estado_origen_id integer NOT NULL,
    estado_destino_id integer NOT NULL,
    rol_code character varying(20) NOT NULL,
    created_at timestamp without time zone NOT NULL
);


--
-- Name: transicion_estado_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.transicion_estado_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: transicion_estado_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.transicion_estado_id_seq OWNED BY public.transicion_estado.id;


--
-- Name: user; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."user" (
    id integer NOT NULL,
    username character varying NOT NULL,
    full_name character varying NOT NULL,
    email character varying NOT NULL,
    hashed_password character varying NOT NULL,
    disabled boolean NOT NULL
);


--
-- Name: user_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.user_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.user_id_seq OWNED BY public."user".id;


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id_user integer NOT NULL,
    rol_code character varying NOT NULL,
    assigned_by_id integer,
    expires_at timestamp without time zone,
    created_at timestamp without time zone NOT NULL
);


--
-- Name: v_insumo; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_insumo AS
 SELECT (id)::text AS id,
    name AS nombre,
    stock_quantity AS "stockDisponible",
    NULL::text AS "unidadMedida",
    NULL::text AS codigo
   FROM public.ingredient i
  WHERE (deleted_at IS NULL);


--
-- Name: v_item_pedido; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_item_pedido AS
 SELECT (id)::text AS id,
    (pedido_id)::text AS "pedidoId",
    (producto_id)::text AS "productoId",
    cantidad,
    producto_precio_unitario AS "precioUnitario"
   FROM public.detalle_pedido dp
  WHERE (deleted_at IS NULL);


--
-- Name: v_pedido; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_pedido AS
 SELECT (p.id)::text AS id,
    p.created_at AS "fechaCreacion",
        CASE
            WHEN (ep.codigo = 'CANCELADO'::public.estado_pedido_codigo) THEN 'cancelado'::text
            ELSE (ep.codigo)::text
        END AS estado,
    p.total,
    NULL::integer AS numero,
    NULL::text AS moneda
   FROM (public.pedido p
     JOIN public.estado_pedido ep ON ((ep.id = p.estado_id)))
  WHERE (p.deleted_at IS NULL);


--
-- Name: v_producto; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_producto AS
 SELECT (id)::text AS id,
    name AS nombre,
    stock_quantity AS "stockDisponible",
    NULL::text AS sku,
    available AS activo
   FROM public.product p
  WHERE (deleted_at IS NULL);


--
-- Name: v_receta_componente; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_receta_componente AS
 SELECT (pi.product_id)::text AS "productoId",
    (pi.ingredient_id)::text AS "insumoId",
    pi.quantity AS "cantidadPorUnidad"
   FROM ((public.product_ingredient pi
     JOIN public.product p ON (((p.id = pi.product_id) AND (p.deleted_at IS NULL))))
     JOIN public.ingredient i ON (((i.id = pi.ingredient_id) AND (i.deleted_at IS NULL))));


--
-- Name: category id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category ALTER COLUMN id SET DEFAULT nextval('public.category_id_seq'::regclass);


--
-- Name: detalle_pedido id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detalle_pedido ALTER COLUMN id SET DEFAULT nextval('public.detalle_pedido_id_seq'::regclass);


--
-- Name: direccion id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.direccion ALTER COLUMN id SET DEFAULT nextval('public.direccion_id_seq'::regclass);


--
-- Name: estado_pedido id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estado_pedido ALTER COLUMN id SET DEFAULT nextval('public.estado_pedido_id_seq'::regclass);


--
-- Name: forma_pago id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forma_pago ALTER COLUMN id SET DEFAULT nextval('public.forma_pago_id_seq'::regclass);


--
-- Name: historial_estado_pedido id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historial_estado_pedido ALTER COLUMN id SET DEFAULT nextval('public.historial_estado_pedido_id_seq'::regclass);


--
-- Name: images id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.images ALTER COLUMN id SET DEFAULT nextval('public.images_id_seq'::regclass);


--
-- Name: ingredient id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingredient ALTER COLUMN id SET DEFAULT nextval('public.ingredient_id_seq'::regclass);


--
-- Name: pagos_mp id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_mp ALTER COLUMN id SET DEFAULT nextval('public.pagos_mp_id_seq'::regclass);


--
-- Name: pedido id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedido ALTER COLUMN id SET DEFAULT nextval('public.pedido_id_seq'::regclass);


--
-- Name: product id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product ALTER COLUMN id SET DEFAULT nextval('public.product_id_seq'::regclass);


--
-- Name: transicion_estado id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transicion_estado ALTER COLUMN id SET DEFAULT nextval('public.transicion_estado_id_seq'::regclass);


--
-- Name: user id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user" ALTER COLUMN id SET DEFAULT nextval('public.user_id_seq'::regclass);


--
-- Data for Name: category; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.category (id, parent_id, name, description, image_url, order_display, is_active, created_at, updated_at, deleted_at) FROM stdin;
1	\N	Hamburguesas	Hamburguesas artesanales	\N	1	t	2026-09-17 13:07:31.577235	2026-09-17 13:07:31.577258	\N
2	\N	Bebidas	Bebidas frías	\N	2	t	2026-09-17 13:07:31.585176	2026-09-17 13:07:31.5852	\N
3	\N	Acompañamientos	Para complementar tu pedido	\N	3	t	2026-09-17 13:07:31.58928	2026-09-17 13:07:31.589306	\N
4	\N	Postres	El toque dulce final	\N	4	t	2026-09-17 13:07:31.592118	2026-09-17 13:07:31.592134	\N
5	1	Clásicas	Las favoritas de siempre	\N	1	t	2026-09-17 13:07:31.594728	2026-09-17 13:07:31.594752	\N
6	1	Premium	Ingredientes seleccionados	\N	2	t	2026-09-17 13:07:31.597471	2026-09-17 13:07:31.597488	\N
7	2	Sin Alcohol	Refrescos, jugos y agua	\N	1	t	2026-09-17 13:07:31.599347	2026-09-17 13:07:31.599362	\N
\.


--
-- Data for Name: detalle_pedido; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.detalle_pedido (id, pedido_id, producto_id, producto_nombre, producto_precio_unitario, cantidad, subtotal, created_at, updated_at, deleted_at) FROM stdin;
1	1	1	Hamburguesa Clásica	1500.00	3	4500.00	2026-09-17 13:07:31.942831	2026-09-17 13:07:31.942855	\N
2	1	7	Coca Cola 500ml	600.00	2	1200.00	2026-09-17 13:07:31.943344	2026-09-17 13:07:31.943364	\N
3	1	5	Papas Fritas	800.00	1	800.00	2026-09-17 13:07:31.943498	2026-09-17 13:07:31.943511	\N
4	2	5	Papas Fritas	800.00	2	1600.00	2026-09-17 13:07:31.970492	2026-09-17 13:07:31.970565	\N
5	3	1	Hamburguesa Clásica	1500.00	1	1500.00	2026-09-17 13:07:31.982016	2026-09-17 13:07:31.982067	\N
6	4	1	Hamburguesa Clásica	1500.00	3	4500.00	2026-09-17 13:07:31.993035	2026-09-17 13:07:31.993085	\N
7	4	3	Hamburguesa Doble	2200.00	3	6600.00	2026-09-17 13:07:31.993529	2026-09-17 13:07:31.993564	\N
8	5	8	Agua Mineral 500ml	400.00	2	800.00	2026-09-17 13:07:32.005495	2026-09-17 13:07:32.00555	\N
9	6	6	Aros de Cebolla	900.00	2	1800.00	2026-09-17 13:07:32.018397	2026-09-17 13:07:32.018446	\N
10	6	5	Papas Fritas	800.00	2	1600.00	2026-09-17 13:07:32.019239	2026-09-17 13:07:32.019299	\N
11	6	3	Hamburguesa Doble	2200.00	2	4400.00	2026-09-17 13:07:32.019603	2026-09-17 13:07:32.019618	\N
12	7	3	Hamburguesa Doble	2200.00	3	6600.00	2026-09-17 13:07:32.032571	2026-09-17 13:07:32.032621	\N
13	7	2	Hamburguesa BBQ Bacon	2000.00	3	6000.00	2026-09-17 13:07:32.033228	2026-09-17 13:07:32.033265	\N
14	8	6	Aros de Cebolla	900.00	1	900.00	2026-09-17 13:07:32.04543	2026-09-17 13:07:32.045479	\N
15	8	9	Brownie de Chocolate	700.00	1	700.00	2026-09-17 13:07:32.045961	2026-09-17 13:07:32.046	\N
16	8	4	Hamburguesa Picante	1900.00	3	5700.00	2026-09-17 13:07:32.046302	2026-09-17 13:07:32.046335	\N
17	9	4	Hamburguesa Picante	1900.00	3	5700.00	2026-09-17 13:07:32.058287	2026-09-17 13:07:32.058344	\N
18	9	9	Brownie de Chocolate	700.00	2	1400.00	2026-09-17 13:07:32.059019	2026-09-17 13:07:32.059063	\N
19	10	3	Hamburguesa Doble	2200.00	1	2200.00	2026-09-17 13:07:32.068725	2026-09-17 13:07:32.068742	\N
20	11	5	Papas Fritas	800.00	1	800.00	2026-09-17 13:07:32.076253	2026-09-17 13:07:32.076273	\N
21	11	2	Hamburguesa BBQ Bacon	2000.00	3	6000.00	2026-09-17 13:07:32.076432	2026-09-17 13:07:32.076444	\N
22	11	4	Hamburguesa Picante	1900.00	3	5700.00	2026-09-17 13:07:32.076601	2026-09-17 13:07:32.076612	\N
23	12	3	Hamburguesa Doble	2200.00	3	6600.00	2026-09-17 13:07:32.088252	2026-09-17 13:07:32.088399	\N
24	13	6	Aros de Cebolla	900.00	3	2700.00	2026-09-17 13:07:32.096417	2026-09-17 13:07:32.096435	\N
25	14	6	Aros de Cebolla	900.00	1	900.00	2026-09-17 13:07:32.104537	2026-09-17 13:07:32.104553	\N
26	14	4	Hamburguesa Picante	1900.00	1	1900.00	2026-09-17 13:07:32.104689	2026-09-17 13:07:32.104699	\N
27	14	5	Papas Fritas	800.00	1	800.00	2026-09-17 13:07:32.104779	2026-09-17 13:07:32.104787	\N
28	15	1	Hamburguesa Clásica	1500.00	1	1500.00	2026-09-17 13:07:32.118494	2026-09-17 13:07:32.118533	\N
29	16	9	Brownie de Chocolate	700.00	2	1400.00	2026-09-17 13:07:32.125599	2026-09-17 13:07:32.125616	\N
30	16	6	Aros de Cebolla	900.00	2	1800.00	2026-09-17 13:07:32.125786	2026-09-17 13:07:32.125799	\N
31	16	5	Papas Fritas	800.00	1	800.00	2026-09-17 13:07:32.125993	2026-09-17 13:07:32.126022	\N
32	17	4	Hamburguesa Picante	1900.00	2	3800.00	2026-09-17 13:07:32.137769	2026-09-17 13:07:32.137785	\N
33	18	5	Papas Fritas	800.00	1	800.00	2026-09-17 13:07:32.147877	2026-09-17 13:07:32.14793	\N
34	18	8	Agua Mineral 500ml	400.00	2	800.00	2026-09-17 13:07:32.148416	2026-09-17 13:07:32.148455	\N
35	19	5	Papas Fritas	800.00	2	1600.00	2026-09-17 13:07:32.15791	2026-09-17 13:07:32.157926	\N
36	19	2	Hamburguesa BBQ Bacon	2000.00	1	2000.00	2026-09-17 13:07:32.158077	2026-09-17 13:07:32.158088	\N
37	20	2	Hamburguesa BBQ Bacon	2000.00	1	2000.00	2026-09-17 13:07:32.164718	2026-09-17 13:07:32.164734	\N
38	21	9	Brownie de Chocolate	700.00	1	700.00	2026-09-17 13:07:32.171449	2026-09-17 13:07:32.171471	\N
39	22	6	Aros de Cebolla	900.00	3	2700.00	2026-09-17 13:07:32.175481	2026-09-17 13:07:32.175496	\N
40	22	6	Aros de Cebolla	900.00	3	2700.00	2026-09-17 13:07:32.175626	2026-09-17 13:07:32.175636	\N
41	22	4	Hamburguesa Picante	1900.00	3	5700.00	2026-09-17 13:07:32.175717	2026-09-17 13:07:32.175726	\N
42	23	7	Coca Cola 500ml	600.00	2	1200.00	2026-09-17 13:07:32.185438	2026-09-17 13:07:32.185484	\N
43	24	3	Hamburguesa Doble	2200.00	1	2200.00	2026-09-17 13:07:32.19315	2026-09-17 13:07:32.193193	\N
44	24	9	Brownie de Chocolate	700.00	2	1400.00	2026-09-17 13:07:32.193563	2026-09-17 13:07:32.193592	\N
45	24	8	Agua Mineral 500ml	400.00	2	800.00	2026-09-17 13:07:32.193827	2026-09-17 13:07:32.193853	\N
46	25	3	Hamburguesa Doble	2200.00	1	2200.00	2026-09-17 13:07:32.20476	2026-09-17 13:07:32.204776	\N
47	26	6	Aros de Cebolla	900.00	1	900.00	2026-09-17 13:07:32.209247	2026-09-17 13:07:32.209263	\N
48	26	3	Hamburguesa Doble	2200.00	1	2200.00	2026-09-17 13:07:32.209396	2026-09-17 13:07:32.209407	\N
49	26	5	Papas Fritas	800.00	3	2400.00	2026-09-17 13:07:32.209489	2026-09-17 13:07:32.209499	\N
50	27	4	Hamburguesa Picante	1900.00	1	1900.00	2026-09-17 13:07:32.217889	2026-09-17 13:07:32.217903	\N
51	27	7	Coca Cola 500ml	600.00	1	600.00	2026-09-17 13:07:32.218031	2026-09-17 13:07:32.21804	\N
52	27	6	Aros de Cebolla	900.00	3	2700.00	2026-09-17 13:07:32.218162	2026-09-17 13:07:32.218173	\N
53	28	9	Brownie de Chocolate	700.00	1	700.00	2026-09-17 13:07:32.222893	2026-09-17 13:07:32.222909	\N
54	28	8	Agua Mineral 500ml	400.00	2	800.00	2026-09-17 13:07:32.223158	2026-09-17 13:07:32.223169	\N
55	29	8	Agua Mineral 500ml	400.00	1	400.00	2026-09-17 13:07:32.230614	2026-09-17 13:07:32.230632	\N
56	30	1	Hamburguesa Clásica	1500.00	1	1500.00	2026-09-17 13:07:32.236043	2026-09-17 13:07:32.236059	\N
57	30	8	Agua Mineral 500ml	400.00	1	400.00	2026-09-17 13:07:32.236186	2026-09-17 13:07:32.236197	\N
58	30	8	Agua Mineral 500ml	400.00	2	800.00	2026-09-17 13:07:32.236275	2026-09-17 13:07:32.236284	\N
59	31	9	Brownie de Chocolate	700.00	2	1400.00	2026-09-17 13:07:32.242705	2026-09-17 13:07:32.242745	\N
60	32	6	Aros de Cebolla	900.00	2	1800.00	2026-09-17 13:07:32.248832	2026-09-17 13:07:32.248849	\N
61	33	1	Hamburguesa Clásica	1500.00	3	4500.00	2026-09-17 13:07:32.25389	2026-09-17 13:07:32.253911	\N
62	33	4	Hamburguesa Picante	1900.00	3	5700.00	2026-09-17 13:07:32.254089	2026-09-17 13:07:32.254103	\N
63	34	8	Agua Mineral 500ml	400.00	2	800.00	2026-09-17 13:07:32.26137	2026-09-17 13:07:32.261446	\N
64	34	7	Coca Cola 500ml	600.00	3	1800.00	2026-09-17 13:07:32.261851	2026-09-17 13:07:32.261889	\N
65	34	3	Hamburguesa Doble	2200.00	2	4400.00	2026-09-17 13:07:32.262123	2026-09-17 13:07:32.262134	\N
66	35	6	Aros de Cebolla	900.00	2	1800.00	2026-09-17 13:07:32.268232	2026-09-17 13:07:32.268248	\N
67	35	4	Hamburguesa Picante	1900.00	2	3800.00	2026-09-17 13:07:32.268388	2026-09-17 13:07:32.268399	\N
68	35	8	Agua Mineral 500ml	400.00	1	400.00	2026-09-17 13:07:32.268484	2026-09-17 13:07:32.268494	\N
69	36	2	Hamburguesa BBQ Bacon	2000.00	3	6000.00	2026-09-17 13:07:32.276861	2026-09-17 13:07:32.276883	\N
70	36	1	Hamburguesa Clásica	1500.00	3	4500.00	2026-09-17 13:07:32.277079	2026-09-17 13:07:32.277093	\N
71	36	5	Papas Fritas	800.00	2	1600.00	2026-09-17 13:07:32.277201	2026-09-17 13:07:32.277214	\N
72	37	3	Hamburguesa Doble	2200.00	2	4400.00	2026-09-17 13:07:32.284937	2026-09-17 13:07:32.284952	\N
73	38	4	Hamburguesa Picante	1900.00	3	5700.00	2026-09-17 13:07:32.292526	2026-09-17 13:07:32.292546	\N
74	38	2	Hamburguesa BBQ Bacon	2000.00	1	2000.00	2026-09-17 13:07:32.292715	2026-09-17 13:07:32.292729	\N
75	39	2	Hamburguesa BBQ Bacon	2000.00	3	6000.00	2026-09-17 13:07:32.300517	2026-09-17 13:07:32.300532	\N
76	39	5	Papas Fritas	800.00	3	2400.00	2026-09-17 13:07:32.300659	2026-09-17 13:07:32.300669	\N
77	40	7	Coca Cola 500ml	600.00	2	1200.00	2026-09-17 13:07:32.307439	2026-09-17 13:07:32.307483	\N
78	41	1	Hamburguesa Clásica	1500.00	2	3000.00	2026-09-17 13:07:32.312945	2026-09-17 13:07:32.31296	\N
79	41	3	Hamburguesa Doble	2200.00	2	4400.00	2026-09-17 13:07:32.313091	2026-09-17 13:07:32.3131	\N
80	42	4	Hamburguesa Picante	1900.00	2	3800.00	2026-09-17 13:07:32.317653	2026-09-17 13:07:32.317672	\N
81	43	1	Hamburguesa Clásica	1500.00	2	3000.00	2026-09-17 13:07:32.325231	2026-09-17 13:07:32.32527	\N
82	43	4	Hamburguesa Picante	1900.00	2	3800.00	2026-09-17 13:07:32.325668	2026-09-17 13:07:32.325694	\N
83	44	7	Coca Cola 500ml	600.00	3	1800.00	2026-09-17 13:07:32.331891	2026-09-17 13:07:32.33192	\N
84	44	8	Agua Mineral 500ml	400.00	1	400.00	2026-09-17 13:07:32.332381	2026-09-17 13:07:32.332405	\N
85	45	6	Aros de Cebolla	900.00	1	900.00	2026-09-17 13:07:32.340773	2026-09-17 13:07:32.340799	\N
86	46	7	Coca Cola 500ml	600.00	2	1200.00	2026-09-17 13:07:32.345452	2026-09-17 13:07:32.345467	\N
87	46	4	Hamburguesa Picante	1900.00	2	3800.00	2026-09-17 13:07:32.345592	2026-09-17 13:07:32.345601	\N
88	47	1	Hamburguesa Clásica	1500.00	1	1500.00	2026-09-17 13:07:32.351485	2026-09-17 13:07:32.3515	\N
89	47	1	Hamburguesa Clásica	1500.00	3	4500.00	2026-09-17 13:07:32.351721	2026-09-17 13:07:32.351743	\N
90	47	3	Hamburguesa Doble	2200.00	1	2200.00	2026-09-17 13:07:32.351913	2026-09-17 13:07:32.351932	\N
91	48	6	Aros de Cebolla	900.00	3	2700.00	2026-09-17 13:07:32.361456	2026-09-17 13:07:32.3615	\N
92	49	9	Brownie de Chocolate	700.00	3	2100.00	2026-09-17 13:07:32.369785	2026-09-17 13:07:32.369804	\N
93	49	2	Hamburguesa BBQ Bacon	2000.00	3	6000.00	2026-09-17 13:07:32.369976	2026-09-17 13:07:32.36999	\N
94	50	5	Papas Fritas	800.00	1	800.00	2026-09-17 13:07:32.377023	2026-09-17 13:07:32.377045	\N
95	50	6	Aros de Cebolla	900.00	3	2700.00	2026-09-17 13:07:32.377227	2026-09-17 13:07:32.377269	\N
96	51	2	Hamburguesa BBQ Bacon	2000.00	3	6000.00	2026-09-17 13:07:32.385524	2026-09-17 13:07:32.385543	\N
97	51	2	Hamburguesa BBQ Bacon	2000.00	2	4000.00	2026-09-17 13:07:32.385713	2026-09-17 13:07:32.385726	\N
98	51	5	Papas Fritas	800.00	3	2400.00	2026-09-17 13:07:32.385835	2026-09-17 13:07:32.385848	\N
99	52	3	Hamburguesa Doble	2200.00	2	4400.00	2026-09-17 13:07:32.39239	2026-09-17 13:07:32.392408	\N
100	53	2	Hamburguesa BBQ Bacon	2000.00	2	4000.00	2026-09-17 13:07:32.399101	2026-09-17 13:07:32.399153	\N
101	53	2	Hamburguesa BBQ Bacon	2000.00	2	4000.00	2026-09-17 13:07:32.399474	2026-09-17 13:07:32.399497	\N
102	54	5	Papas Fritas	800.00	2	1600.00	2026-09-17 13:07:32.407792	2026-09-17 13:07:32.407814	\N
103	54	3	Hamburguesa Doble	2200.00	3	6600.00	2026-09-17 13:07:32.408003	2026-09-17 13:07:32.408018	\N
104	55	5	Papas Fritas	800.00	3	2400.00	2026-09-17 13:07:32.420268	2026-09-17 13:07:32.420312	\N
105	55	4	Hamburguesa Picante	1900.00	3	5700.00	2026-09-17 13:07:32.420758	2026-09-17 13:07:32.42079	\N
106	56	7	Coca Cola 500ml	600.00	3	1800.00	2026-09-17 13:07:32.430797	2026-09-17 13:07:32.430824	\N
107	57	8	Agua Mineral 500ml	400.00	2	800.00	2026-09-17 13:07:32.439905	2026-09-17 13:07:32.439921	\N
108	58	3	Hamburguesa Doble	2200.00	2	4400.00	2026-09-17 13:07:32.449558	2026-09-17 13:07:32.449601	\N
109	58	9	Brownie de Chocolate	700.00	1	700.00	2026-09-17 13:07:32.450219	2026-09-17 13:07:32.450311	\N
110	58	6	Aros de Cebolla	900.00	1	900.00	2026-09-17 13:07:32.451216	2026-09-17 13:07:32.451252	\N
111	59	8	Agua Mineral 500ml	400.00	2	800.00	2026-09-17 13:07:32.463155	2026-09-17 13:07:32.463177	\N
112	60	7	Coca Cola 500ml	600.00	1	600.00	2026-09-17 13:07:32.471162	2026-09-17 13:07:32.471182	\N
113	60	6	Aros de Cebolla	900.00	3	2700.00	2026-09-17 13:07:32.471347	2026-09-17 13:07:32.47136	\N
114	60	8	Agua Mineral 500ml	400.00	2	800.00	2026-09-17 13:07:32.471464	2026-09-17 13:07:32.471475	\N
115	61	9	Brownie de Chocolate	700.00	3	2100.00	2026-09-17 13:07:32.479652	2026-09-17 13:07:32.479693	\N
116	61	1	Hamburguesa Clásica	1500.00	1	1500.00	2026-09-17 13:07:32.480039	2026-09-17 13:07:32.480122	\N
117	61	7	Coca Cola 500ml	600.00	2	1200.00	2026-09-17 13:07:32.48037	2026-09-17 13:07:32.480395	\N
118	62	7	Coca Cola 500ml	600.00	1	600.00	2026-09-17 13:07:32.486525	2026-09-17 13:07:32.486542	\N
119	62	5	Papas Fritas	800.00	1	800.00	2026-09-17 13:07:32.486685	2026-09-17 13:07:32.486696	\N
120	63	6	Aros de Cebolla	900.00	1	900.00	2026-09-17 13:07:32.493535	2026-09-17 13:07:32.493554	\N
121	63	8	Agua Mineral 500ml	400.00	3	1200.00	2026-09-17 13:07:32.493716	2026-09-17 13:07:32.493729	\N
122	63	2	Hamburguesa BBQ Bacon	2000.00	1	2000.00	2026-09-17 13:07:32.49389	2026-09-17 13:07:32.493913	\N
123	64	5	Papas Fritas	800.00	2	1600.00	2026-09-17 13:07:32.500687	2026-09-17 13:07:32.500702	\N
124	65	3	Hamburguesa Doble	2200.00	3	6600.00	2026-09-17 13:07:32.504617	2026-09-17 13:07:32.504641	\N
125	65	3	Hamburguesa Doble	2200.00	3	6600.00	2026-09-17 13:07:32.504946	2026-09-17 13:07:32.504971	\N
126	65	1	Hamburguesa Clásica	1500.00	3	4500.00	2026-09-17 13:07:32.505146	2026-09-17 13:07:32.505164	\N
127	66	2	Hamburguesa BBQ Bacon	2000.00	3	6000.00	2026-09-17 13:07:32.515699	2026-09-17 13:07:32.515723	\N
128	66	6	Aros de Cebolla	900.00	2	1800.00	2026-09-17 13:07:32.515917	2026-09-17 13:07:32.515932	\N
129	67	4	Hamburguesa Picante	1900.00	3	5700.00	2026-09-17 13:07:32.523451	2026-09-17 13:07:32.523475	\N
130	67	5	Papas Fritas	800.00	2	1600.00	2026-09-17 13:07:32.523707	2026-09-17 13:07:32.523727	\N
131	68	8	Agua Mineral 500ml	400.00	2	800.00	2026-09-17 13:07:32.530276	2026-09-17 13:07:32.530294	\N
132	68	1	Hamburguesa Clásica	1500.00	2	3000.00	2026-09-17 13:07:32.530447	2026-09-17 13:07:32.530458	\N
133	68	8	Agua Mineral 500ml	400.00	1	400.00	2026-09-17 13:07:32.530552	2026-09-17 13:07:32.530563	\N
134	69	2	Hamburguesa BBQ Bacon	2000.00	2	4000.00	2026-09-17 13:07:32.535619	2026-09-17 13:07:32.535639	\N
135	69	3	Hamburguesa Doble	2200.00	1	2200.00	2026-09-17 13:07:32.535796	2026-09-17 13:07:32.535809	\N
136	69	8	Agua Mineral 500ml	400.00	1	400.00	2026-09-17 13:07:32.535904	2026-09-17 13:07:32.535915	\N
137	70	3	Hamburguesa Doble	2200.00	1	2200.00	2026-09-17 13:07:32.543409	2026-09-17 13:07:32.543429	\N
138	71	8	Agua Mineral 500ml	400.00	1	400.00	2026-09-17 13:07:32.547532	2026-09-17 13:07:32.547548	\N
139	71	9	Brownie de Chocolate	700.00	2	1400.00	2026-09-17 13:07:32.547675	2026-09-17 13:07:32.547685	\N
140	72	4	Hamburguesa Picante	1900.00	2	3800.00	2026-09-17 13:07:32.552288	2026-09-17 13:07:32.552303	\N
141	72	8	Agua Mineral 500ml	400.00	1	400.00	2026-09-17 13:07:32.552425	2026-09-17 13:07:32.552435	\N
142	73	5	Papas Fritas	800.00	2	1600.00	2026-09-17 13:07:32.558461	2026-09-17 13:07:32.55848	\N
143	73	3	Hamburguesa Doble	2200.00	2	4400.00	2026-09-17 13:07:32.558649	2026-09-17 13:07:32.558663	\N
144	73	7	Coca Cola 500ml	600.00	2	1200.00	2026-09-17 13:07:32.558777	2026-09-17 13:07:32.55879	\N
145	74	9	Brownie de Chocolate	700.00	3	2100.00	2026-09-17 13:07:32.563367	2026-09-17 13:07:32.563381	\N
146	74	4	Hamburguesa Picante	1900.00	1	1900.00	2026-09-17 13:07:32.563504	2026-09-17 13:07:32.563514	\N
147	74	9	Brownie de Chocolate	700.00	2	1400.00	2026-09-17 13:07:32.563588	2026-09-17 13:07:32.563597	\N
148	75	7	Coca Cola 500ml	600.00	2	1200.00	2026-09-17 13:07:32.569761	2026-09-17 13:07:32.569787	\N
149	76	8	Agua Mineral 500ml	400.00	2	800.00	2026-09-17 13:07:32.575929	2026-09-17 13:07:32.575946	\N
150	76	8	Agua Mineral 500ml	400.00	2	800.00	2026-09-17 13:07:32.576079	2026-09-17 13:07:32.57609	\N
151	77	9	Brownie de Chocolate	700.00	3	2100.00	2026-09-17 13:07:32.58099	2026-09-17 13:07:32.581009	\N
152	77	7	Coca Cola 500ml	600.00	1	600.00	2026-09-17 13:07:32.581166	2026-09-17 13:07:32.581184	\N
153	78	2	Hamburguesa BBQ Bacon	2000.00	3	6000.00	2026-09-17 13:07:32.589603	2026-09-17 13:07:32.589652	\N
154	78	5	Papas Fritas	800.00	3	2400.00	2026-09-17 13:07:32.59002	2026-09-17 13:07:32.590046	\N
155	79	5	Papas Fritas	800.00	2	1600.00	2026-09-17 13:07:32.595513	2026-09-17 13:07:32.595529	\N
156	80	9	Brownie de Chocolate	700.00	2	1400.00	2026-09-17 13:07:32.600838	2026-09-17 13:07:32.600873	\N
157	80	3	Hamburguesa Doble	2200.00	3	6600.00	2026-09-17 13:07:32.601098	2026-09-17 13:07:32.601116	\N
158	81	4	Hamburguesa Picante	1900.00	1	1900.00	2026-09-17 13:07:32.606701	2026-09-17 13:07:32.606724	\N
159	81	3	Hamburguesa Doble	2200.00	3	6600.00	2026-09-17 13:07:32.607005	2026-09-17 13:07:32.607032	\N
160	81	7	Coca Cola 500ml	600.00	2	1200.00	2026-09-17 13:07:32.607178	2026-09-17 13:07:32.607192	\N
161	82	2	Hamburguesa BBQ Bacon	2000.00	3	6000.00	2026-09-17 13:07:32.612376	2026-09-17 13:07:32.612406	\N
162	82	3	Hamburguesa Doble	2200.00	3	6600.00	2026-09-17 13:07:32.612657	2026-09-17 13:07:32.612677	\N
163	82	7	Coca Cola 500ml	600.00	1	600.00	2026-09-17 13:07:32.612832	2026-09-17 13:07:32.612851	\N
164	83	9	Brownie de Chocolate	700.00	2	1400.00	2026-09-17 13:07:32.62308	2026-09-17 13:07:32.623133	\N
165	84	3	Hamburguesa Doble	2200.00	2	4400.00	2026-09-17 13:07:32.630613	2026-09-17 13:07:32.630683	\N
166	85	8	Agua Mineral 500ml	400.00	3	1200.00	2026-09-17 13:07:32.640768	2026-09-17 13:07:32.640795	\N
167	86	4	Hamburguesa Picante	1900.00	2	3800.00	2026-09-17 13:07:32.648328	2026-09-17 13:07:32.648368	\N
168	86	7	Coca Cola 500ml	600.00	3	1800.00	2026-09-17 13:07:32.648682	2026-09-17 13:07:32.648706	\N
169	87	1	Hamburguesa Clásica	1500.00	2	3000.00	2026-09-17 13:07:32.659643	2026-09-17 13:07:32.659683	\N
170	87	8	Agua Mineral 500ml	400.00	3	1200.00	2026-09-17 13:07:32.659969	2026-09-17 13:07:32.659992	\N
171	87	9	Brownie de Chocolate	700.00	2	1400.00	2026-09-17 13:07:32.660161	2026-09-17 13:07:32.660183	\N
172	88	5	Papas Fritas	800.00	3	2400.00	2026-09-17 13:07:32.671804	2026-09-17 13:07:32.67184	\N
173	88	7	Coca Cola 500ml	600.00	3	1800.00	2026-09-17 13:07:32.672135	2026-09-17 13:07:32.672158	\N
174	89	6	Aros de Cebolla	900.00	2	1800.00	2026-09-17 13:07:32.682911	2026-09-17 13:07:32.682935	\N
175	89	9	Brownie de Chocolate	700.00	1	700.00	2026-09-17 13:07:32.683239	2026-09-17 13:07:32.683257	\N
176	90	4	Hamburguesa Picante	1900.00	1	1900.00	2026-09-17 13:07:32.693321	2026-09-17 13:07:32.693356	\N
177	91	3	Hamburguesa Doble	2200.00	3	6600.00	2026-09-17 13:07:32.70341	2026-09-17 13:07:32.703438	\N
178	91	2	Hamburguesa BBQ Bacon	2000.00	1	2000.00	2026-09-17 13:07:32.703679	2026-09-17 13:07:32.703699	\N
179	92	1	Hamburguesa Clásica	1500.00	1	1500.00	2026-09-17 13:07:32.712869	2026-09-17 13:07:32.712907	\N
180	92	8	Agua Mineral 500ml	400.00	3	1200.00	2026-09-17 13:07:32.713326	2026-09-17 13:07:32.713355	\N
181	92	2	Hamburguesa BBQ Bacon	2000.00	2	4000.00	2026-09-17 13:07:32.713575	2026-09-17 13:07:32.713599	\N
182	93	3	Hamburguesa Doble	2200.00	3	6600.00	2026-09-17 13:07:32.722127	2026-09-17 13:07:32.722156	\N
183	93	2	Hamburguesa BBQ Bacon	2000.00	2	4000.00	2026-09-17 13:07:32.722609	2026-09-17 13:07:32.722634	\N
184	93	1	Hamburguesa Clásica	1500.00	3	4500.00	2026-09-17 13:07:32.722763	2026-09-17 13:07:32.722778	\N
185	94	5	Papas Fritas	800.00	1	800.00	2026-09-17 13:07:32.729911	2026-09-17 13:07:32.729935	\N
186	94	9	Brownie de Chocolate	700.00	3	2100.00	2026-09-17 13:07:32.730254	2026-09-17 13:07:32.730271	\N
187	95	7	Coca Cola 500ml	600.00	1	600.00	2026-09-17 13:07:32.73559	2026-09-17 13:07:32.735604	\N
188	95	4	Hamburguesa Picante	1900.00	2	3800.00	2026-09-17 13:07:32.73573	2026-09-17 13:07:32.73574	\N
189	96	9	Brownie de Chocolate	700.00	2	1400.00	2026-09-17 13:07:32.741441	2026-09-17 13:07:32.741455	\N
190	96	5	Papas Fritas	800.00	3	2400.00	2026-09-17 13:07:32.74171	2026-09-17 13:07:32.741721	\N
191	97	5	Papas Fritas	800.00	2	1600.00	2026-09-17 13:07:32.747715	2026-09-17 13:07:32.747757	\N
192	97	3	Hamburguesa Doble	2200.00	2	4400.00	2026-09-17 13:07:32.747937	2026-09-17 13:07:32.74795	\N
193	98	1	Hamburguesa Clásica	1500.00	1	1500.00	2026-09-17 13:07:32.752668	2026-09-17 13:07:32.752684	\N
194	99	6	Aros de Cebolla	900.00	3	2700.00	2026-09-17 13:07:32.760639	2026-09-17 13:07:32.760678	\N
\.


--
-- Data for Name: direccion; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.direccion (id, usuario_id, alias, calle, numero, piso_dpto, ciudad, provincia, codigo_postal, latitud, longitud, es_principal, created_at, updated_at, deleted_at) FROM stdin;
1	2	Casa	Calle Demo	100	\N	Ciudad Demo	Provincia Demo	0000	\N	\N	t	2026-09-17 13:07:31.906824	2026-09-17 13:07:31.906885	\N
\.


--
-- Data for Name: estado_pedido; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.estado_pedido (id, codigo, descripcion, orden, created_at) FROM stdin;
1	PENDIENTE	Pedido recibido, esperando confirmación	1	2026-09-17 13:07:31.454743
2	CONFIRMADO	Pago confirmado, listo para preparar	2	2026-09-17 13:07:31.463942
3	EN_PREP	En preparación en cocina	3	2026-09-17 13:07:31.468078
4	LISTO	Listo para entrega — preparación finalizada en cocina	4	2026-09-17 13:07:31.471759
5	ENTREGADO	Entregado exitosamente	5	2026-09-17 13:07:31.475547
6	CANCELADO	Pedido cancelado	6	2026-09-17 13:07:31.480512
\.


--
-- Data for Name: forma_pago; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.forma_pago (id, nombre, descripcion, requiere_monto_pago, is_active, created_at, updated_at, deleted_at) FROM stdin;
1	Efectivo	Pago en efectivo al recibir	t	t	2026-09-17 13:07:31.551707	2026-09-17 13:07:31.551732	\N
2	Tarjeta Débito	Pago con tarjeta de débito	f	t	2026-09-17 13:07:31.558363	2026-09-17 13:07:31.558412	\N
3	Tarjeta Crédito	Pago con tarjeta de crédito	f	t	2026-09-17 13:07:31.564107	2026-09-17 13:07:31.564139	\N
4	Mercado Pago	Pago mediante plataforma Mercado Pago	f	t	2026-09-17 13:07:31.569266	2026-09-17 13:07:31.569308	\N
\.


--
-- Data for Name: historial_estado_pedido; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.historial_estado_pedido (id, pedido_id, estado_id, usuario_cambio_id, observaciones, created_at) FROM stdin;
1	1	1	1	\N	2026-08-18 13:47:31.934432
2	1	2	4	\N	2026-08-18 13:37:31.934432
3	1	6	1	\N	2026-08-18 15:00:31.934432
4	2	1	1	\N	2026-08-18 13:56:31.934432
5	2	2	4	\N	2026-08-18 14:06:31.934432
6	2	3	5	\N	2026-08-18 14:39:31.934432
7	2	4	5	\N	2026-08-18 14:23:31.934432
8	2	5	4	\N	2026-08-18 14:31:31.934432
9	3	1	1	\N	2026-08-19 13:28:31.934432
10	3	2	4	\N	2026-08-19 14:55:31.934432
11	3	3	5	\N	2026-08-19 13:23:31.934432
12	3	4	5	\N	2026-08-19 16:18:31.934432
13	3	5	4	\N	2026-08-19 17:07:31.934432
14	4	1	1	\N	2026-08-19 13:24:31.934432
15	4	2	4	\N	2026-08-19 14:42:31.934432
16	4	3	5	\N	2026-08-19 13:29:31.934432
17	4	4	5	\N	2026-08-19 13:23:31.934432
18	4	5	4	\N	2026-08-19 15:08:31.934432
19	5	1	1	\N	2026-08-20 13:35:31.934432
20	5	2	4	\N	2026-08-20 13:57:31.934432
21	5	3	5	\N	2026-08-20 14:05:31.934432
22	5	4	5	\N	2026-08-20 16:03:31.934432
23	5	5	4	\N	2026-08-20 15:28:31.934432
24	6	1	1	\N	2026-08-20 13:32:31.934432
25	6	2	4	\N	2026-08-20 14:59:31.934432
26	6	3	5	\N	2026-08-20 13:26:31.934432
27	6	4	5	\N	2026-08-20 14:10:31.934432
28	6	5	4	\N	2026-08-20 13:28:31.934432
29	7	1	1	\N	2026-08-20 13:53:31.934432
30	7	2	4	\N	2026-08-20 14:10:31.934432
31	7	3	5	\N	2026-08-20 13:48:31.934432
32	7	4	5	\N	2026-08-20 14:19:31.934432
33	7	5	4	\N	2026-08-20 14:23:31.934432
34	8	1	1	\N	2026-08-21 13:21:31.934432
35	8	2	4	\N	2026-08-21 14:32:31.934432
36	8	3	5	\N	2026-08-21 13:52:31.934432
37	8	4	5	\N	2026-08-21 16:34:31.934432
38	8	5	4	\N	2026-08-21 16:48:31.934432
39	9	1	1	\N	2026-08-21 13:58:31.934432
40	9	2	4	\N	2026-08-21 13:26:31.934432
41	9	3	5	\N	2026-08-21 16:06:31.934432
42	9	4	5	\N	2026-08-21 16:58:31.934432
43	9	5	4	\N	2026-08-21 17:46:31.934432
44	10	1	1	\N	2026-08-22 14:00:31.934432
45	10	2	4	\N	2026-08-22 13:34:31.934432
46	10	3	5	\N	2026-08-22 15:21:31.934432
47	10	4	5	\N	2026-08-22 17:05:31.934432
48	10	5	4	\N	2026-08-22 14:06:31.934432
49	11	1	1	\N	2026-08-22 13:13:31.934432
50	11	2	4	\N	2026-08-22 13:26:31.934432
51	11	3	5	\N	2026-08-22 14:44:31.934432
52	11	4	5	\N	2026-08-22 16:56:31.934432
53	11	5	4	\N	2026-08-22 15:49:31.934432
54	12	1	1	\N	2026-08-22 13:43:31.934432
55	12	2	4	\N	2026-08-22 14:56:31.934432
56	12	3	5	\N	2026-08-22 13:29:31.934432
57	12	4	5	\N	2026-08-22 16:26:31.934432
58	12	5	4	\N	2026-08-22 17:44:31.934432
59	13	1	1	\N	2026-08-22 13:46:31.934432
60	13	2	4	\N	2026-08-22 14:48:31.934432
61	13	3	5	\N	2026-08-22 14:03:31.934432
62	13	4	5	\N	2026-08-22 16:14:31.934432
63	13	5	4	\N	2026-08-22 15:51:31.934432
64	14	1	1	\N	2026-08-22 13:49:31.934432
65	14	2	4	\N	2026-08-22 13:40:31.934432
66	14	6	1	\N	2026-08-22 13:37:31.934432
67	15	1	1	\N	2026-08-23 13:27:31.934432
68	15	2	4	\N	2026-08-23 13:47:31.934432
69	15	3	5	\N	2026-08-23 16:03:31.934432
70	15	4	5	\N	2026-08-23 15:16:31.934432
71	15	5	4	\N	2026-08-23 15:01:31.934432
72	16	1	1	\N	2026-08-23 13:38:31.934432
73	16	2	4	\N	2026-08-23 14:11:31.934432
74	16	3	5	\N	2026-08-23 13:25:31.934432
75	16	6	1	\N	2026-08-23 15:03:31.934432
76	17	1	1	\N	2026-08-23 13:24:31.934432
77	17	2	4	\N	2026-08-23 13:36:31.934432
78	17	3	5	\N	2026-08-23 15:29:31.934432
79	17	4	5	\N	2026-08-23 15:06:31.934432
80	17	5	4	\N	2026-08-23 14:23:31.934432
81	18	1	1	\N	2026-08-24 13:53:31.934432
82	18	2	4	\N	2026-08-24 14:21:31.934432
83	18	3	5	\N	2026-08-24 13:15:31.934432
84	18	4	5	\N	2026-08-24 13:35:31.934432
85	18	5	4	\N	2026-08-24 15:13:31.934432
86	19	1	1	\N	2026-08-24 13:28:31.934432
87	19	2	4	\N	2026-08-24 14:52:31.934432
88	19	3	5	\N	2026-08-24 15:08:31.934432
89	19	4	5	\N	2026-08-24 14:25:31.934432
90	19	5	4	\N	2026-08-24 16:48:31.934432
91	20	1	1	\N	2026-08-24 13:32:31.934432
92	20	2	4	\N	2026-08-24 13:19:31.934432
93	20	3	5	\N	2026-08-24 13:24:31.934432
94	20	4	5	\N	2026-08-24 15:41:31.934432
95	20	5	4	\N	2026-08-24 17:16:31.934432
96	21	1	1	\N	2026-08-25 13:16:31.934432
97	21	2	4	\N	2026-08-25 14:38:31.934432
98	21	3	5	\N	2026-08-25 14:12:31.934432
99	21	4	5	\N	2026-08-25 14:55:31.934432
100	21	5	4	\N	2026-08-25 14:13:31.934432
101	22	1	1	\N	2026-08-25 13:54:31.934432
102	22	2	4	\N	2026-08-25 14:43:31.934432
103	22	3	5	\N	2026-08-25 14:32:31.934432
104	22	4	5	\N	2026-08-25 14:13:31.934432
105	22	5	4	\N	2026-08-25 15:27:31.934432
106	23	1	1	\N	2026-08-25 13:41:31.934432
107	23	2	4	\N	2026-08-25 14:31:31.934432
108	23	3	5	\N	2026-08-25 15:36:31.934432
109	23	4	5	\N	2026-08-25 13:37:31.934432
110	23	5	4	\N	2026-08-25 13:49:31.934432
111	24	1	1	\N	2026-08-25 14:03:31.934432
112	24	2	4	\N	2026-08-25 14:35:31.934432
113	24	3	5	\N	2026-08-25 15:27:31.934432
114	24	4	5	\N	2026-08-25 13:14:31.934432
115	24	5	4	\N	2026-08-25 17:55:31.934432
116	25	1	1	\N	2026-08-26 13:30:31.934432
117	25	2	4	\N	2026-08-26 14:29:31.934432
118	25	3	5	\N	2026-08-26 14:05:31.934432
119	25	4	5	\N	2026-08-26 16:15:31.934432
120	25	5	4	\N	2026-08-26 16:07:31.934432
121	26	1	1	\N	2026-08-26 13:12:31.934432
122	26	2	4	\N	2026-08-26 13:54:31.934432
123	26	3	5	\N	2026-08-26 13:45:31.934432
124	26	4	5	\N	2026-08-26 15:55:31.934432
125	26	5	4	\N	2026-08-26 15:26:31.934432
126	27	1	1	\N	2026-08-26 13:49:31.934432
127	27	2	4	\N	2026-08-26 14:22:31.934432
128	27	3	5	\N	2026-08-26 13:49:31.934432
129	27	4	5	\N	2026-08-26 15:02:31.934432
130	27	5	4	\N	2026-08-26 14:17:31.934432
131	28	1	1	\N	2026-08-27 13:18:31.934432
132	28	2	4	\N	2026-08-27 13:57:31.934432
133	28	3	5	\N	2026-08-27 15:35:31.934432
134	28	4	5	\N	2026-08-27 16:58:31.934432
135	28	5	4	\N	2026-08-27 16:40:31.934432
136	29	1	1	\N	2026-08-27 13:59:31.934432
137	29	2	4	\N	2026-08-27 13:54:31.934432
138	29	3	5	\N	2026-08-27 14:57:31.934432
139	29	4	5	\N	2026-08-27 16:37:31.934432
140	29	5	4	\N	2026-08-27 15:19:31.934432
141	30	1	1	\N	2026-08-28 13:13:31.934432
142	30	2	4	\N	2026-08-28 14:36:31.934432
143	30	3	5	\N	2026-08-28 14:01:31.934432
144	30	4	5	\N	2026-08-28 14:54:31.934432
145	30	5	4	\N	2026-08-28 16:00:31.934432
146	31	1	1	\N	2026-08-28 14:05:31.934432
147	31	2	4	\N	2026-08-28 14:20:31.934432
148	31	3	5	\N	2026-08-28 14:36:31.934432
149	31	4	5	\N	2026-08-28 13:19:31.934432
150	31	5	4	\N	2026-08-28 14:11:31.934432
151	32	1	1	\N	2026-08-28 13:39:31.934432
152	32	2	4	\N	2026-08-28 14:29:31.934432
153	32	3	5	\N	2026-08-28 15:22:31.934432
154	32	6	1	\N	2026-08-28 13:51:31.934432
155	33	1	1	\N	2026-08-29 13:39:31.934432
156	33	2	4	\N	2026-08-29 13:20:31.934432
157	33	3	5	\N	2026-08-29 16:02:31.934432
158	33	4	5	\N	2026-08-29 17:07:31.934432
159	33	5	4	\N	2026-08-29 16:01:31.934432
160	34	1	1	\N	2026-08-29 13:20:31.934432
161	34	2	4	\N	2026-08-29 13:36:31.934432
162	34	3	5	\N	2026-08-29 14:59:31.934432
163	34	4	5	\N	2026-08-29 16:02:31.934432
164	34	5	4	\N	2026-08-29 16:26:31.934432
165	35	1	1	\N	2026-08-29 13:40:31.934432
166	35	2	4	\N	2026-08-29 14:08:31.934432
167	35	3	5	\N	2026-08-29 16:04:31.934432
168	35	4	5	\N	2026-08-29 14:06:31.934432
169	35	5	4	\N	2026-08-29 17:33:31.934432
170	36	1	1	\N	2026-08-29 13:26:31.934432
171	36	2	4	\N	2026-08-29 14:55:31.934432
172	36	3	5	\N	2026-08-29 14:02:31.934432
173	36	6	1	\N	2026-08-29 13:55:31.934432
174	37	1	1	\N	2026-08-29 13:38:31.934432
175	37	2	4	\N	2026-08-29 15:05:31.934432
176	37	3	5	\N	2026-08-29 15:53:31.934432
177	37	4	5	\N	2026-08-29 15:39:31.934432
178	37	5	4	\N	2026-08-29 14:51:31.934432
179	38	1	1	\N	2026-08-29 13:26:31.934432
180	38	2	4	\N	2026-08-29 13:34:31.934432
181	38	3	5	\N	2026-08-29 15:24:31.934432
182	38	4	5	\N	2026-08-29 15:10:31.934432
183	38	5	4	\N	2026-08-29 13:37:31.934432
184	39	1	1	\N	2026-08-30 14:04:31.934432
185	39	2	4	\N	2026-08-30 14:44:31.934432
186	39	3	5	\N	2026-08-30 15:21:31.934432
187	39	4	5	\N	2026-08-30 15:01:31.934432
188	39	5	4	\N	2026-08-30 17:52:31.934432
189	40	1	1	\N	2026-08-30 13:29:31.934432
190	40	2	4	\N	2026-08-30 14:50:31.934432
191	40	3	5	\N	2026-08-30 15:25:31.934432
192	40	4	5	\N	2026-08-30 15:16:31.934432
193	40	5	4	\N	2026-08-30 15:14:31.934432
194	41	1	1	\N	2026-08-30 13:21:31.934432
195	41	2	4	\N	2026-08-30 13:41:31.934432
196	41	3	5	\N	2026-08-30 14:50:31.934432
197	41	4	5	\N	2026-08-30 16:09:31.934432
198	41	5	4	\N	2026-08-30 14:30:31.934432
199	42	1	1	\N	2026-08-30 13:25:31.934432
200	42	2	4	\N	2026-08-30 14:58:31.934432
201	42	3	5	\N	2026-08-30 14:59:31.934432
202	42	4	5	\N	2026-08-30 14:51:31.934432
203	42	5	4	\N	2026-08-30 13:22:31.934432
204	43	1	1	\N	2026-08-31 13:26:31.934432
205	43	2	4	\N	2026-08-31 13:46:31.934432
206	43	3	5	\N	2026-08-31 15:03:31.934432
207	43	4	5	\N	2026-08-31 15:16:31.934432
208	43	5	4	\N	2026-08-31 13:26:31.934432
209	44	1	1	\N	2026-08-31 13:46:31.934432
210	44	2	4	\N	2026-08-31 13:15:31.934432
211	44	3	5	\N	2026-08-31 14:52:31.934432
212	44	4	5	\N	2026-08-31 15:43:31.934432
213	44	5	4	\N	2026-08-31 18:00:31.934432
214	45	1	1	\N	2026-08-31 13:28:31.934432
215	45	2	4	\N	2026-08-31 14:00:31.934432
216	45	3	5	\N	2026-08-31 14:35:31.934432
217	45	4	5	\N	2026-08-31 14:06:31.934432
218	45	5	4	\N	2026-08-31 17:04:31.934432
219	46	1	1	\N	2026-08-31 13:59:31.934432
220	46	2	4	\N	2026-08-31 14:21:31.934432
221	46	3	5	\N	2026-08-31 13:25:31.934432
222	46	4	5	\N	2026-08-31 14:41:31.934432
223	46	5	4	\N	2026-08-31 15:06:31.934432
224	47	1	1	\N	2026-09-01 13:19:31.934432
225	47	2	4	\N	2026-09-01 14:24:31.934432
226	47	3	5	\N	2026-09-01 14:07:31.934432
227	47	4	5	\N	2026-09-01 15:11:31.934432
228	47	5	4	\N	2026-09-01 15:23:31.934432
229	48	1	1	\N	2026-09-01 13:18:31.934432
230	48	2	4	\N	2026-09-01 14:26:31.934432
231	48	3	5	\N	2026-09-01 13:18:31.934432
232	48	4	5	\N	2026-09-01 14:31:31.934432
233	48	5	4	\N	2026-09-01 18:06:31.934432
234	49	1	1	\N	2026-09-01 13:56:31.934432
235	49	2	4	\N	2026-09-01 14:50:31.934432
236	49	3	5	\N	2026-09-01 14:29:31.934432
237	49	4	5	\N	2026-09-01 16:49:31.934432
238	49	5	4	\N	2026-09-01 14:13:31.934432
239	50	1	1	\N	2026-09-01 14:04:31.934432
240	50	2	4	\N	2026-09-01 14:14:31.934432
241	50	3	5	\N	2026-09-01 13:39:31.934432
242	50	4	5	\N	2026-09-01 15:02:31.934432
243	50	5	4	\N	2026-09-01 16:17:31.934432
244	51	1	1	\N	2026-09-02 13:39:31.934432
245	51	2	4	\N	2026-09-02 14:57:31.934432
246	51	3	5	\N	2026-09-02 15:43:31.934432
247	51	4	5	\N	2026-09-02 14:20:31.934432
248	51	5	4	\N	2026-09-02 15:57:31.934432
249	52	1	1	\N	2026-09-02 13:51:31.934432
250	52	2	4	\N	2026-09-02 14:37:31.934432
251	52	3	5	\N	2026-09-02 14:49:31.934432
252	52	4	5	\N	2026-09-02 14:38:31.934432
253	52	5	4	\N	2026-09-02 13:26:31.934432
254	53	1	1	\N	2026-09-02 13:12:31.934432
255	53	2	4	\N	2026-09-02 14:18:31.934432
256	53	3	5	\N	2026-09-02 14:00:31.934432
257	53	4	5	\N	2026-09-02 13:33:31.934432
258	53	5	4	\N	2026-09-02 15:15:31.934432
259	54	1	1	\N	2026-09-02 13:17:31.934432
260	54	2	4	\N	2026-09-02 13:49:31.934432
261	54	3	5	\N	2026-09-02 14:08:31.934432
262	54	4	5	\N	2026-09-02 14:55:31.934432
263	54	5	4	\N	2026-09-02 15:16:31.934432
264	55	1	1	\N	2026-09-03 13:31:31.934432
265	55	2	4	\N	2026-09-03 13:44:31.934432
266	55	3	5	\N	2026-09-03 14:11:31.934432
267	55	4	5	\N	2026-09-03 13:42:31.934432
268	55	5	4	\N	2026-09-03 14:50:31.934432
269	56	1	1	\N	2026-09-03 13:42:31.934432
270	56	2	4	\N	2026-09-03 13:47:31.934432
271	56	3	5	\N	2026-09-03 15:42:31.934432
272	56	4	5	\N	2026-09-03 16:26:31.934432
273	56	5	4	\N	2026-09-03 17:40:31.934432
274	57	1	1	\N	2026-09-03 13:12:31.934432
275	57	2	4	\N	2026-09-03 14:42:31.934432
276	57	3	5	\N	2026-09-03 15:28:31.934432
277	57	4	5	\N	2026-09-03 13:44:31.934432
278	57	5	4	\N	2026-09-03 15:32:31.934432
279	58	1	1	\N	2026-09-04 13:40:31.934432
280	58	2	4	\N	2026-09-04 13:55:31.934432
281	58	3	5	\N	2026-09-04 13:59:31.934432
282	58	4	5	\N	2026-09-04 13:25:31.934432
283	58	5	4	\N	2026-09-04 15:21:31.934432
284	59	1	1	\N	2026-09-04 13:21:31.934432
285	59	2	4	\N	2026-09-04 14:55:31.934432
286	59	3	5	\N	2026-09-04 15:36:31.934432
287	59	4	5	\N	2026-09-04 14:29:31.934432
288	59	5	4	\N	2026-09-04 13:55:31.934432
289	60	1	1	\N	2026-09-05 14:07:31.934432
290	60	2	4	\N	2026-09-05 14:27:31.934432
291	60	3	5	\N	2026-09-05 15:01:31.934432
292	60	4	5	\N	2026-09-05 14:30:31.934432
293	60	5	4	\N	2026-09-05 18:03:31.934432
294	61	1	1	\N	2026-09-05 13:23:31.934432
295	61	2	4	\N	2026-09-05 14:22:31.934432
296	61	3	5	\N	2026-09-05 13:31:31.934432
297	61	4	5	\N	2026-09-05 13:52:31.934432
298	61	5	4	\N	2026-09-05 13:13:31.934432
299	62	1	1	\N	2026-09-05 14:07:31.934432
300	62	2	4	\N	2026-09-05 14:10:31.934432
301	62	3	5	\N	2026-09-05 13:30:31.934432
302	62	4	5	\N	2026-09-05 16:07:31.934432
303	62	5	4	\N	2026-09-05 15:11:31.934432
304	63	1	1	\N	2026-09-05 13:16:31.934432
305	63	2	4	\N	2026-09-05 13:19:31.934432
306	63	3	5	\N	2026-09-05 13:54:31.934432
307	63	4	5	\N	2026-09-05 16:34:31.934432
308	63	5	4	\N	2026-09-05 15:49:31.934432
309	64	1	1	\N	2026-09-06 13:46:31.934432
310	64	2	4	\N	2026-09-06 14:15:31.934432
311	64	3	5	\N	2026-09-06 15:04:31.934432
312	64	4	5	\N	2026-09-06 13:32:31.934432
313	64	5	4	\N	2026-09-06 13:32:31.934432
314	65	1	1	\N	2026-09-06 13:14:31.934432
315	65	2	4	\N	2026-09-06 14:49:31.934432
316	65	3	5	\N	2026-09-06 13:56:31.934432
317	65	4	5	\N	2026-09-06 15:12:31.934432
318	65	5	4	\N	2026-09-06 17:37:31.934432
319	66	1	1	\N	2026-09-06 13:38:31.934432
320	66	2	4	\N	2026-09-06 13:54:31.934432
321	66	3	5	\N	2026-09-06 14:34:31.934432
322	66	4	5	\N	2026-09-06 16:03:31.934432
323	66	5	4	\N	2026-09-06 14:05:31.934432
324	67	1	1	\N	2026-09-06 13:17:31.934432
325	67	2	4	\N	2026-09-06 13:52:31.934432
326	67	3	5	\N	2026-09-06 14:16:31.934432
327	67	4	5	\N	2026-09-06 14:34:31.934432
328	67	5	4	\N	2026-09-06 14:11:31.934432
329	68	1	1	\N	2026-09-06 14:00:31.934432
330	68	2	4	\N	2026-09-06 14:15:31.934432
331	68	3	5	\N	2026-09-06 15:52:31.934432
332	68	4	5	\N	2026-09-06 15:05:31.934432
333	68	5	4	\N	2026-09-06 13:38:31.934432
334	69	1	1	\N	2026-09-07 13:22:31.934432
335	69	2	4	\N	2026-09-07 13:51:31.934432
336	69	3	5	\N	2026-09-07 15:33:31.934432
337	69	4	5	\N	2026-09-07 13:15:31.934432
338	69	5	4	\N	2026-09-07 17:54:31.934432
339	70	1	1	\N	2026-09-07 14:05:31.934432
340	70	2	4	\N	2026-09-07 13:31:31.934432
341	70	3	5	\N	2026-09-07 15:19:31.934432
342	70	4	5	\N	2026-09-07 16:15:31.934432
343	70	5	4	\N	2026-09-07 15:41:31.934432
344	71	1	1	\N	2026-09-08 13:50:31.934432
345	71	2	4	\N	2026-09-08 14:17:31.934432
346	71	3	5	\N	2026-09-08 13:46:31.934432
347	71	4	5	\N	2026-09-08 16:53:31.934432
348	71	5	4	\N	2026-09-08 13:47:31.934432
349	72	1	1	\N	2026-09-08 13:49:31.934432
350	72	2	4	\N	2026-09-08 14:36:31.934432
351	72	3	5	\N	2026-09-08 15:17:31.934432
352	72	4	5	\N	2026-09-08 16:53:31.934432
353	72	5	4	\N	2026-09-08 14:28:31.934432
354	73	1	1	\N	2026-09-08 13:36:31.934432
355	73	2	4	\N	2026-09-08 13:41:31.934432
356	73	3	5	\N	2026-09-08 14:57:31.934432
357	73	4	5	\N	2026-09-08 13:23:31.934432
358	73	5	4	\N	2026-09-08 15:54:31.934432
359	74	1	1	\N	2026-09-08 13:49:31.934432
360	74	2	4	\N	2026-09-08 13:54:31.934432
361	74	3	5	\N	2026-09-08 13:37:31.934432
362	74	4	5	\N	2026-09-08 16:55:31.934432
363	74	5	4	\N	2026-09-08 16:57:31.934432
364	75	1	1	\N	2026-09-09 13:42:31.934432
365	75	2	4	\N	2026-09-09 14:52:31.934432
366	75	3	5	\N	2026-09-09 14:19:31.934432
367	75	4	5	\N	2026-09-09 14:38:31.934432
368	75	5	4	\N	2026-09-09 16:35:31.934432
369	76	1	1	\N	2026-09-09 13:14:31.934432
370	76	2	4	\N	2026-09-09 14:31:31.934432
371	76	3	5	\N	2026-09-09 13:29:31.934432
372	76	4	5	\N	2026-09-09 14:12:31.934432
373	76	5	4	\N	2026-09-09 15:39:31.934432
374	77	1	1	\N	2026-09-10 13:14:31.934432
375	77	2	4	\N	2026-09-10 13:53:31.934432
376	77	3	5	\N	2026-09-10 13:26:31.934432
377	77	4	5	\N	2026-09-10 14:27:31.934432
378	77	5	4	\N	2026-09-10 16:15:31.934432
379	78	1	1	\N	2026-09-10 13:17:31.934432
380	78	2	4	\N	2026-09-10 14:30:31.934432
381	78	3	5	\N	2026-09-10 14:49:31.934432
382	78	4	5	\N	2026-09-10 15:50:31.934432
383	78	5	4	\N	2026-09-10 15:15:31.934432
384	79	1	1	\N	2026-09-11 13:30:31.934432
385	79	2	4	\N	2026-09-11 14:38:31.934432
386	79	3	5	\N	2026-09-11 15:31:31.934432
387	79	4	5	\N	2026-09-11 13:52:31.934432
388	79	5	4	\N	2026-09-11 13:49:31.934432
389	80	1	1	\N	2026-09-11 13:36:31.934432
390	80	2	4	\N	2026-09-11 15:01:31.934432
391	80	3	5	\N	2026-09-11 15:15:31.934432
392	80	4	5	\N	2026-09-11 13:39:31.934432
393	80	5	4	\N	2026-09-11 15:13:31.934432
394	81	1	1	\N	2026-09-11 13:59:31.934432
395	81	2	4	\N	2026-09-11 14:15:31.934432
396	81	3	5	\N	2026-09-11 14:25:31.934432
397	81	4	5	\N	2026-09-11 16:30:31.934432
398	81	5	4	\N	2026-09-11 15:09:31.934432
399	82	1	1	\N	2026-09-12 14:02:31.934432
400	82	2	4	\N	2026-09-12 14:08:31.934432
401	82	3	5	\N	2026-09-12 13:20:31.934432
402	82	4	5	\N	2026-09-12 15:40:31.934432
403	82	5	4	\N	2026-09-12 16:18:31.934432
404	83	1	1	\N	2026-09-12 13:20:31.934432
405	83	2	4	\N	2026-09-12 14:52:31.934432
406	83	3	5	\N	2026-09-12 15:30:31.934432
407	83	4	5	\N	2026-09-12 16:56:31.934432
408	83	5	4	\N	2026-09-12 16:19:31.934432
409	84	1	1	\N	2026-09-12 14:07:31.934432
410	84	2	4	\N	2026-09-12 13:55:31.934432
411	84	3	5	\N	2026-09-12 13:41:31.934432
412	84	4	5	\N	2026-09-12 15:11:31.934432
413	84	5	4	\N	2026-09-12 13:50:31.934432
414	85	1	1	\N	2026-09-12 13:35:31.934432
415	85	2	4	\N	2026-09-12 13:23:31.934432
416	85	3	5	\N	2026-09-12 14:53:31.934432
417	85	4	5	\N	2026-09-12 13:15:31.934432
418	85	5	4	\N	2026-09-12 15:27:31.934432
419	86	1	1	\N	2026-09-12 13:55:31.934432
420	86	2	4	\N	2026-09-12 13:41:31.934432
421	86	3	5	\N	2026-09-12 15:12:31.934432
422	86	4	5	\N	2026-09-12 13:18:31.934432
423	86	5	4	\N	2026-09-12 17:59:31.934432
424	87	1	1	\N	2026-09-13 13:43:31.934432
425	87	2	4	\N	2026-09-13 13:26:31.934432
426	87	3	5	\N	2026-09-13 13:36:31.934432
427	87	6	1	\N	2026-09-13 14:07:31.934432
428	88	1	1	\N	2026-09-13 13:59:31.934432
429	88	2	4	\N	2026-09-13 14:45:31.934432
430	88	3	5	\N	2026-09-13 13:51:31.934432
431	88	4	5	\N	2026-09-13 16:58:31.934432
432	88	5	4	\N	2026-09-13 16:44:31.934432
433	89	1	1	\N	2026-09-13 13:40:31.934432
434	89	2	4	\N	2026-09-13 13:42:31.934432
435	89	3	5	\N	2026-09-13 14:44:31.934432
436	89	4	5	\N	2026-09-13 13:37:31.934432
437	89	5	4	\N	2026-09-13 16:20:31.934432
438	90	1	1	\N	2026-09-13 13:54:31.934432
439	90	2	4	\N	2026-09-13 13:39:31.934432
440	90	3	5	\N	2026-09-13 15:56:31.934432
441	90	4	5	\N	2026-09-13 15:55:31.934432
442	90	5	4	\N	2026-09-13 13:22:31.934432
443	91	1	1	\N	2026-09-13 14:04:31.934432
444	91	2	4	\N	2026-09-13 15:03:31.934432
445	91	6	1	\N	2026-09-13 14:06:31.934432
446	92	1	1	\N	2026-09-14 14:07:31.934432
447	92	2	4	\N	2026-09-14 13:15:31.934432
448	92	3	5	\N	2026-09-14 13:45:31.934432
449	92	4	5	\N	2026-09-14 13:15:31.934432
450	92	5	4	\N	2026-09-14 16:15:31.934432
451	93	1	1	\N	2026-09-14 14:01:31.934432
452	93	2	4	\N	2026-09-14 13:58:31.934432
453	93	3	5	\N	2026-09-14 15:23:31.934432
454	93	6	1	\N	2026-09-14 14:52:31.934432
455	94	1	1	\N	2026-09-14 13:53:31.934432
456	94	2	4	\N	2026-09-14 13:15:31.934432
457	94	3	5	\N	2026-09-14 13:27:31.934432
458	94	4	5	\N	2026-09-14 15:14:31.934432
459	94	5	4	\N	2026-09-14 16:37:31.934432
460	95	1	1	\N	2026-09-15 13:29:31.934432
461	95	2	4	\N	2026-09-15 14:31:31.934432
462	95	3	5	\N	2026-09-15 15:54:31.934432
463	95	4	5	\N	2026-09-15 15:41:31.934432
464	95	5	4	\N	2026-09-15 17:52:31.934432
465	96	1	1	\N	2026-09-15 13:19:31.934432
466	96	2	4	\N	2026-09-15 15:01:31.934432
467	96	3	5	\N	2026-09-15 15:59:31.934432
468	96	4	5	\N	2026-09-15 15:58:31.934432
469	96	5	4	\N	2026-09-15 17:54:31.934432
470	97	1	1	\N	2026-09-15 13:39:31.934432
471	97	2	4	\N	2026-09-15 13:52:31.934432
472	97	3	5	\N	2026-09-15 16:02:31.934432
473	97	4	5	\N	2026-09-15 14:17:31.934432
474	97	5	4	\N	2026-09-15 16:23:31.934432
475	98	1	1	\N	2026-09-16 13:59:31.934432
476	98	2	4	\N	2026-09-16 14:46:31.934432
477	99	1	1	\N	2026-09-16 13:34:31.934432
478	99	2	4	\N	2026-09-16 15:03:31.934432
479	99	3	5	\N	2026-09-16 16:02:31.934432
480	99	4	5	\N	2026-09-16 16:24:31.934432
\.


--
-- Data for Name: images; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.images (id, public_id, url, filename, format, width, height, bytes, created_at) FROM stdin;
\.


--
-- Data for Name: ingredient; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.ingredient (id, name, description, stock_quantity, is_allergen, is_active, created_at, updated_at, deleted_at) FROM stdin;
1	Pan brioche	Pan suave y esponjoso	120	t	t	2026-09-17 13:07:31.605966	2026-09-17 13:07:31.605988	\N
2	Carne vacuna	Medallón de carne 200g	80	f	t	2026-09-17 13:07:31.61179	2026-09-17 13:07:31.611815	\N
3	Lechuga	Lechuga fresca	60	f	t	2026-09-17 13:07:31.614863	2026-09-17 13:07:31.614903	\N
4	Tomate	Tomate fresco en rodajas	50	f	t	2026-09-17 13:07:31.617426	2026-09-17 13:07:31.617445	\N
5	Cebolla	Cebolla morada	70	f	t	2026-09-17 13:07:31.620177	2026-09-17 13:07:31.620193	\N
6	Queso cheddar	Queso cheddar fundido	90	t	t	2026-09-17 13:07:31.621862	2026-09-17 13:07:31.621887	\N
7	Bacon	Panceta crocante	40	f	t	2026-09-17 13:07:31.623984	2026-09-17 13:07:31.623998	\N
8	Mayonesa	Mayonesa casera	200	t	t	2026-09-17 13:07:31.625464	2026-09-17 13:07:31.625478	\N
9	Ketchup	Salsa ketchup	200	f	t	2026-09-17 13:07:31.626682	2026-09-17 13:07:31.626697	\N
10	Mostaza	Mostaza Dijón	150	f	t	2026-09-17 13:07:31.627847	2026-09-17 13:07:31.627861	\N
11	Salsa BBQ	Salsa BBQ ahumada	100	f	t	2026-09-17 13:07:31.629204	2026-09-17 13:07:31.62922	\N
12	Jalapeños	Jalapeños encurtidos	30	f	t	2026-09-17 13:07:31.630785	2026-09-17 13:07:31.630804	\N
13	Papas	Papa blanca	250	f	t	2026-09-17 13:07:31.633777	2026-09-17 13:07:31.633794	\N
14	Huevo	Huevo frito	8	t	t	2026-09-17 13:07:31.635835	2026-09-17 13:07:31.635849	\N
\.


--
-- Data for Name: pagos_mp; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.pagos_mp (id, pedido_id, mp_payment_id, mp_status, mp_status_detail, transaction_amount, external_reference, idempotency_key, checkout_data, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: pedido; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.pedido (id, usuario_id, direccion_entrega_id, forma_pago_id, estado_id, subtotal, costo_envio, total, notas_cliente, created_at, updated_at, deleted_at) FROM stdin;
1	2	1	2	6	6500.00	500.00	7000.00	\N	2026-08-18 13:07:31.934432	2026-08-18 13:07:31.934432	\N
2	2	1	1	5	1600.00	500.00	2100.00	\N	2026-08-18 13:07:31.934432	2026-08-18 13:07:31.934432	\N
3	2	1	3	5	1500.00	500.00	2000.00	Bien de sal	2026-08-19 13:07:31.934432	2026-08-19 13:07:31.934432	\N
4	2	1	3	5	11100.00	500.00	11600.00	Bien de sal	2026-08-19 13:07:31.934432	2026-08-19 13:07:31.934432	\N
5	2	1	3	5	800.00	500.00	1300.00	\N	2026-08-20 13:07:31.934432	2026-08-20 13:07:31.934432	\N
6	2	1	2	5	7800.00	500.00	8300.00	Salsa extra	2026-08-20 13:07:31.934432	2026-08-20 13:07:31.934432	\N
7	2	1	4	5	12600.00	500.00	13100.00	Sin cebolla por favor	2026-08-20 13:07:31.934432	2026-08-20 13:07:31.934432	\N
8	2	1	1	5	7300.00	500.00	7800.00	\N	2026-08-21 13:07:31.934432	2026-08-21 13:07:31.934432	\N
9	2	1	1	5	7100.00	500.00	7600.00	Salsa extra	2026-08-21 13:07:31.934432	2026-08-21 13:07:31.934432	\N
10	2	1	3	5	2200.00	500.00	2700.00	Bien de sal	2026-08-22 13:07:31.934432	2026-08-22 13:07:31.934432	\N
11	2	1	3	5	12500.00	500.00	13000.00	Sin cebolla por favor	2026-08-22 13:07:31.934432	2026-08-22 13:07:31.934432	\N
12	2	1	1	5	6600.00	500.00	7100.00	Salsa extra	2026-08-22 13:07:31.934432	2026-08-22 13:07:31.934432	\N
13	2	1	4	5	2700.00	500.00	3200.00	\N	2026-08-22 13:07:31.934432	2026-08-22 13:07:31.934432	\N
14	2	1	1	6	3600.00	500.00	4100.00	Bien de sal	2026-08-22 13:07:31.934432	2026-08-22 13:07:31.934432	\N
15	2	1	1	5	1500.00	500.00	2000.00	Bien de sal	2026-08-23 13:07:31.934432	2026-08-23 13:07:31.934432	\N
16	2	1	4	6	4000.00	500.00	4500.00	\N	2026-08-23 13:07:31.934432	2026-08-23 13:07:31.934432	\N
17	2	1	1	5	3800.00	500.00	4300.00	\N	2026-08-23 13:07:31.934432	2026-08-23 13:07:31.934432	\N
18	2	1	1	5	1600.00	500.00	2100.00	\N	2026-08-24 13:07:31.934432	2026-08-24 13:07:31.934432	\N
19	2	1	1	5	3600.00	500.00	4100.00	Sin cebolla por favor	2026-08-24 13:07:31.934432	2026-08-24 13:07:31.934432	\N
20	2	1	1	5	2000.00	500.00	2500.00	Salsa extra	2026-08-24 13:07:31.934432	2026-08-24 13:07:31.934432	\N
21	2	1	1	5	700.00	500.00	1200.00	Bien de sal	2026-08-25 13:07:31.934432	2026-08-25 13:07:31.934432	\N
22	2	1	3	5	11100.00	500.00	11600.00	\N	2026-08-25 13:07:31.934432	2026-08-25 13:07:31.934432	\N
23	2	1	1	5	1200.00	500.00	1700.00	\N	2026-08-25 13:07:31.934432	2026-08-25 13:07:31.934432	\N
24	2	1	3	5	4400.00	500.00	4900.00	Bien de sal	2026-08-25 13:07:31.934432	2026-08-25 13:07:31.934432	\N
25	2	1	2	5	2200.00	500.00	2700.00	\N	2026-08-26 13:07:31.934432	2026-08-26 13:07:31.934432	\N
26	2	1	3	5	5500.00	500.00	6000.00	\N	2026-08-26 13:07:31.934432	2026-08-26 13:07:31.934432	\N
27	2	1	1	5	5200.00	500.00	5700.00	\N	2026-08-26 13:07:31.934432	2026-08-26 13:07:31.934432	\N
28	2	1	2	5	1500.00	500.00	2000.00	Salsa extra	2026-08-27 13:07:31.934432	2026-08-27 13:07:31.934432	\N
29	2	1	1	5	400.00	500.00	900.00	\N	2026-08-27 13:07:31.934432	2026-08-27 13:07:31.934432	\N
30	2	1	2	5	2700.00	500.00	3200.00	\N	2026-08-28 13:07:31.934432	2026-08-28 13:07:31.934432	\N
31	2	1	4	5	1400.00	500.00	1900.00	Salsa extra	2026-08-28 13:07:31.934432	2026-08-28 13:07:31.934432	\N
32	2	1	4	6	1800.00	500.00	2300.00	\N	2026-08-28 13:07:31.934432	2026-08-28 13:07:31.934432	\N
33	2	1	2	5	10200.00	500.00	10700.00	\N	2026-08-29 13:07:31.934432	2026-08-29 13:07:31.934432	\N
34	2	1	3	5	7000.00	500.00	7500.00	Bien de sal	2026-08-29 13:07:31.934432	2026-08-29 13:07:31.934432	\N
35	2	1	3	5	6000.00	500.00	6500.00	Sin cebolla por favor	2026-08-29 13:07:31.934432	2026-08-29 13:07:31.934432	\N
36	2	1	2	6	12100.00	500.00	12600.00	Salsa extra	2026-08-29 13:07:31.934432	2026-08-29 13:07:31.934432	\N
37	2	1	1	5	4400.00	500.00	4900.00	Sin cebolla por favor	2026-08-29 13:07:31.934432	2026-08-29 13:07:31.934432	\N
38	2	1	1	5	7700.00	500.00	8200.00	Sin cebolla por favor	2026-08-29 13:07:31.934432	2026-08-29 13:07:31.934432	\N
39	2	1	4	5	8400.00	500.00	8900.00	Bien de sal	2026-08-30 13:07:31.934432	2026-08-30 13:07:31.934432	\N
40	2	1	2	5	1200.00	500.00	1700.00	Salsa extra	2026-08-30 13:07:31.934432	2026-08-30 13:07:31.934432	\N
41	2	1	1	5	7400.00	500.00	7900.00	\N	2026-08-30 13:07:31.934432	2026-08-30 13:07:31.934432	\N
42	2	1	4	5	3800.00	500.00	4300.00	\N	2026-08-30 13:07:31.934432	2026-08-30 13:07:31.934432	\N
43	2	1	2	5	6800.00	500.00	7300.00	Sin cebolla por favor	2026-08-31 13:07:31.934432	2026-08-31 13:07:31.934432	\N
44	2	1	2	5	2200.00	500.00	2700.00	Bien de sal	2026-08-31 13:07:31.934432	2026-08-31 13:07:31.934432	\N
45	2	1	2	5	900.00	500.00	1400.00	\N	2026-08-31 13:07:31.934432	2026-08-31 13:07:31.934432	\N
46	2	1	4	5	5000.00	500.00	5500.00	\N	2026-08-31 13:07:31.934432	2026-08-31 13:07:31.934432	\N
47	2	1	4	5	8200.00	500.00	8700.00	Salsa extra	2026-09-01 13:07:31.934432	2026-09-01 13:07:31.934432	\N
48	2	1	2	5	2700.00	500.00	3200.00	\N	2026-09-01 13:07:31.934432	2026-09-01 13:07:31.934432	\N
49	2	1	2	5	8100.00	500.00	8600.00	\N	2026-09-01 13:07:31.934432	2026-09-01 13:07:31.934432	\N
50	2	1	1	5	3500.00	500.00	4000.00	Sin cebolla por favor	2026-09-01 13:07:31.934432	2026-09-01 13:07:31.934432	\N
51	2	1	4	5	12400.00	500.00	12900.00	Sin cebolla por favor	2026-09-02 13:07:31.934432	2026-09-02 13:07:31.934432	\N
52	2	1	4	5	4400.00	500.00	4900.00	Bien de sal	2026-09-02 13:07:31.934432	2026-09-02 13:07:31.934432	\N
53	2	1	3	5	8000.00	500.00	8500.00	Bien de sal	2026-09-02 13:07:31.934432	2026-09-02 13:07:31.934432	\N
54	2	1	4	5	8200.00	500.00	8700.00	\N	2026-09-02 13:07:31.934432	2026-09-02 13:07:31.934432	\N
55	2	1	4	5	8100.00	500.00	8600.00	\N	2026-09-03 13:07:31.934432	2026-09-03 13:07:31.934432	\N
56	2	1	2	5	1800.00	500.00	2300.00	Salsa extra	2026-09-03 13:07:31.934432	2026-09-03 13:07:31.934432	\N
57	2	1	2	5	800.00	500.00	1300.00	\N	2026-09-03 13:07:31.934432	2026-09-03 13:07:31.934432	\N
58	2	1	4	5	6000.00	500.00	6500.00	Sin cebolla por favor	2026-09-04 13:07:31.934432	2026-09-04 13:07:31.934432	\N
59	2	1	1	5	800.00	500.00	1300.00	\N	2026-09-04 13:07:31.934432	2026-09-04 13:07:31.934432	\N
60	2	1	4	5	4100.00	500.00	4600.00	\N	2026-09-05 13:07:31.934432	2026-09-05 13:07:31.934432	\N
61	2	1	2	5	4800.00	500.00	5300.00	\N	2026-09-05 13:07:31.934432	2026-09-05 13:07:31.934432	\N
62	2	1	3	5	1400.00	500.00	1900.00	Salsa extra	2026-09-05 13:07:31.934432	2026-09-05 13:07:31.934432	\N
63	2	1	3	5	4100.00	500.00	4600.00	\N	2026-09-05 13:07:31.934432	2026-09-05 13:07:31.934432	\N
64	2	1	3	5	1600.00	500.00	2100.00	Bien de sal	2026-09-06 13:07:31.934432	2026-09-06 13:07:31.934432	\N
65	2	1	3	5	17700.00	500.00	18200.00	Bien de sal	2026-09-06 13:07:31.934432	2026-09-06 13:07:31.934432	\N
66	2	1	4	5	7800.00	500.00	8300.00	\N	2026-09-06 13:07:31.934432	2026-09-06 13:07:31.934432	\N
67	2	1	1	5	7300.00	500.00	7800.00	Sin cebolla por favor	2026-09-06 13:07:31.934432	2026-09-06 13:07:31.934432	\N
68	2	1	3	5	4200.00	500.00	4700.00	Bien de sal	2026-09-06 13:07:31.934432	2026-09-06 13:07:31.934432	\N
69	2	1	2	5	6600.00	500.00	7100.00	Salsa extra	2026-09-07 13:07:31.934432	2026-09-07 13:07:31.934432	\N
70	2	1	1	5	2200.00	500.00	2700.00	Salsa extra	2026-09-07 13:07:31.934432	2026-09-07 13:07:31.934432	\N
71	2	1	4	5	1800.00	500.00	2300.00	\N	2026-09-08 13:07:31.934432	2026-09-08 13:07:31.934432	\N
72	2	1	3	5	4200.00	500.00	4700.00	Bien de sal	2026-09-08 13:07:31.934432	2026-09-08 13:07:31.934432	\N
73	2	1	2	5	7200.00	500.00	7700.00	Bien de sal	2026-09-08 13:07:31.934432	2026-09-08 13:07:31.934432	\N
74	2	1	2	5	5400.00	500.00	5900.00	Bien de sal	2026-09-08 13:07:31.934432	2026-09-08 13:07:31.934432	\N
75	2	1	2	5	1200.00	500.00	1700.00	\N	2026-09-09 13:07:31.934432	2026-09-09 13:07:31.934432	\N
76	2	1	4	5	1600.00	500.00	2100.00	Bien de sal	2026-09-09 13:07:31.934432	2026-09-09 13:07:31.934432	\N
77	2	1	3	5	2700.00	500.00	3200.00	\N	2026-09-10 13:07:31.934432	2026-09-10 13:07:31.934432	\N
78	2	1	2	5	8400.00	500.00	8900.00	\N	2026-09-10 13:07:31.934432	2026-09-10 13:07:31.934432	\N
79	2	1	1	5	1600.00	500.00	2100.00	Sin cebolla por favor	2026-09-11 13:07:31.934432	2026-09-11 13:07:31.934432	\N
80	2	1	3	5	8000.00	500.00	8500.00	\N	2026-09-11 13:07:31.934432	2026-09-11 13:07:31.934432	\N
81	2	1	1	5	9700.00	500.00	10200.00	Bien de sal	2026-09-11 13:07:31.934432	2026-09-11 13:07:31.934432	\N
82	2	1	1	5	13200.00	500.00	13700.00	\N	2026-09-12 13:07:31.934432	2026-09-12 13:07:31.934432	\N
83	2	1	2	5	1400.00	500.00	1900.00	\N	2026-09-12 13:07:31.934432	2026-09-12 13:07:31.934432	\N
84	2	1	3	5	4400.00	500.00	4900.00	Salsa extra	2026-09-12 13:07:31.934432	2026-09-12 13:07:31.934432	\N
85	2	1	4	5	1200.00	500.00	1700.00	Bien de sal	2026-09-12 13:07:31.934432	2026-09-12 13:07:31.934432	\N
86	2	1	3	5	5600.00	500.00	6100.00	\N	2026-09-12 13:07:31.934432	2026-09-12 13:07:31.934432	\N
87	2	1	1	6	5600.00	500.00	6100.00	\N	2026-09-13 13:07:31.934432	2026-09-13 13:07:31.934432	\N
88	2	1	4	5	4200.00	500.00	4700.00	Bien de sal	2026-09-13 13:07:31.934432	2026-09-13 13:07:31.934432	\N
89	2	1	2	5	2500.00	500.00	3000.00	Sin cebolla por favor	2026-09-13 13:07:31.934432	2026-09-13 13:07:31.934432	\N
90	2	1	4	5	1900.00	500.00	2400.00	\N	2026-09-13 13:07:31.934432	2026-09-13 13:07:31.934432	\N
91	2	1	2	6	8600.00	500.00	9100.00	Bien de sal	2026-09-13 13:07:31.934432	2026-09-13 13:07:31.934432	\N
92	2	1	1	5	6700.00	500.00	7200.00	Salsa extra	2026-09-14 13:07:31.934432	2026-09-14 13:07:31.934432	\N
93	2	1	1	6	15100.00	500.00	15600.00	Sin cebolla por favor	2026-09-14 13:07:31.934432	2026-09-14 13:07:31.934432	\N
94	2	1	3	5	2900.00	500.00	3400.00	Sin cebolla por favor	2026-09-14 13:07:31.934432	2026-09-14 13:07:31.934432	\N
95	2	1	1	5	4400.00	500.00	4900.00	\N	2026-09-15 13:07:31.934432	2026-09-15 13:07:31.934432	\N
96	2	1	1	5	3800.00	500.00	4300.00	Salsa extra	2026-09-15 13:07:31.934432	2026-09-15 13:07:31.934432	\N
97	2	1	1	5	6000.00	500.00	6500.00	\N	2026-09-15 13:07:31.934432	2026-09-15 13:07:31.934432	\N
98	2	1	4	2	1500.00	500.00	2000.00	\N	2026-09-16 13:07:31.934432	2026-09-16 13:07:31.934432	\N
99	2	1	1	4	2700.00	500.00	3200.00	Sin cebolla por favor	2026-09-16 13:07:31.934432	2026-09-16 13:07:31.934432	\N
\.


--
-- Data for Name: product; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.product (id, name, description, base_price, image_urls, stock_quantity, prep_time_min, available, created_at, updated_at, deleted_at) FROM stdin;
1	Hamburguesa Clásica	La clásica de siempre: carne, lechuga, tomate y mayonesa	1500.00	{}	50	15	t	2026-09-17 13:07:31.644378	2026-09-17 13:07:31.644405	\N
2	Hamburguesa BBQ Bacon	Carne jugosa, bacon crocante y salsa BBQ ahumada	2000.00	{}	30	20	t	2026-09-17 13:07:31.705501	2026-09-17 13:07:31.705516	\N
3	Hamburguesa Doble	Doble medallón de carne con queso cheddar	2200.00	{}	25	20	t	2026-09-17 13:07:31.738721	2026-09-17 13:07:31.738737	\N
4	Hamburguesa Picante	Para los que la quieren con fuego: jalapeños y salsa BBQ	1900.00	{}	20	18	t	2026-09-17 13:07:31.791792	2026-09-17 13:07:31.791843	\N
5	Papas Fritas	Papas fritas crocantes con sal	800.00	{}	100	10	t	2026-09-17 13:07:31.827475	2026-09-17 13:07:31.827506	\N
6	Aros de Cebolla	Cebolla rebozada y frita	900.00	{}	80	12	t	2026-09-17 13:07:31.836429	2026-09-17 13:07:31.836452	\N
7	Coca Cola 500ml	Bebida gaseosa fría	600.00	{}	150	1	t	2026-09-17 13:07:31.844481	2026-09-17 13:07:31.844501	\N
8	Agua Mineral 500ml	Agua mineral sin gas	400.00	{}	200	1	t	2026-09-17 13:07:31.866781	2026-09-17 13:07:31.866827	\N
9	Brownie de Chocolate	Brownie casero con chips de chocolate	700.00	{}	40	5	t	2026-09-17 13:07:31.878563	2026-09-17 13:07:31.878598	\N
\.


--
-- Data for Name: product_category; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.product_category (product_id, category_id, is_primary, created_at) FROM stdin;
1	5	t	2026-09-17 13:07:31.653711
1	1	f	2026-09-17 13:07:31.659088
2	6	t	2026-09-17 13:07:31.71102
2	1	f	2026-09-17 13:07:31.714035
3	5	t	2026-09-17 13:07:31.741439
3	1	f	2026-09-17 13:07:31.744561
4	6	t	2026-09-17 13:07:31.797698
4	1	f	2026-09-17 13:07:31.803709
5	3	t	2026-09-17 13:07:31.83063
6	3	t	2026-09-17 13:07:31.839416
7	7	t	2026-09-17 13:07:31.848603
7	2	f	2026-09-17 13:07:31.853769
8	7	t	2026-09-17 13:07:31.871662
8	2	f	2026-09-17 13:07:31.875243
9	4	t	2026-09-17 13:07:31.884309
\.


--
-- Data for Name: product_ingredient; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.product_ingredient (product_id, ingredient_id, is_removable, quantity, created_at) FROM stdin;
1	1	f	1	2026-09-17 13:07:31.668669
1	2	f	1	2026-09-17 13:07:31.67708
1	3	t	1	2026-09-17 13:07:31.682825
1	4	t	1	2026-09-17 13:07:31.689065
1	5	t	1	2026-09-17 13:07:31.693416
1	8	t	1	2026-09-17 13:07:31.701138
2	1	f	1	2026-09-17 13:07:31.717567
2	2	f	1	2026-09-17 13:07:31.720167
2	6	t	1	2026-09-17 13:07:31.72299
2	7	t	2	2026-09-17 13:07:31.72674
2	11	t	1	2026-09-17 13:07:31.733686
2	5	t	1	2026-09-17 13:07:31.73679
3	1	f	1	2026-09-17 13:07:31.748392
3	2	f	2	2026-09-17 13:07:31.75316
3	6	t	2	2026-09-17 13:07:31.762792
3	3	t	1	2026-09-17 13:07:31.769871
3	4	t	1	2026-09-17 13:07:31.775391
3	8	t	1	2026-09-17 13:07:31.78413
4	1	f	1	2026-09-17 13:07:31.808383
4	2	f	1	2026-09-17 13:07:31.812621
4	12	t	2	2026-09-17 13:07:31.816664
4	6	t	1	2026-09-17 13:07:31.81912
4	11	t	1	2026-09-17 13:07:31.821976
4	8	t	1	2026-09-17 13:07:31.824116
5	13	f	1	2026-09-17 13:07:31.833599
6	5	f	1	2026-09-17 13:07:31.841891
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.roles (code, name, description) FROM stdin;
ADMIN	Administrador	Acceso total sin restricciones
STOCK	Stock	Actualiza stock y disponible
PEDIDOS	Pedidos	Avanza estados CONFIRMADO a ENTREGADO
COCINA	Cocina	Prepara y marca pedidos listos para entrega
CLIENT	Cliente	Opera solo sus propios datos
\.


--
-- Data for Name: transicion_estado; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.transicion_estado (id, estado_origen_id, estado_destino_id, rol_code, created_at) FROM stdin;
1	1	2	ADMIN	2026-09-17 13:07:31.49272
2	1	6	ADMIN	2026-09-17 13:07:31.498652
3	2	3	ADMIN	2026-09-17 13:07:31.502554
4	2	6	ADMIN	2026-09-17 13:07:31.50502
5	3	4	ADMIN	2026-09-17 13:07:31.508421
6	3	6	ADMIN	2026-09-17 13:07:31.511467
7	4	5	ADMIN	2026-09-17 13:07:31.515091
8	4	6	ADMIN	2026-09-17 13:07:31.51844
9	1	2	PEDIDOS	2026-09-17 13:07:31.522626
10	1	6	PEDIDOS	2026-09-17 13:07:31.52596
11	4	5	PEDIDOS	2026-09-17 13:07:31.529873
12	2	3	COCINA	2026-09-17 13:07:31.5344
13	2	6	COCINA	2026-09-17 13:07:31.538135
14	3	4	COCINA	2026-09-17 13:07:31.541845
\.


--
-- Data for Name: user; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public."user" (id, username, full_name, email, hashed_password, disabled) FROM stdin;
1	demo1	Usuario Demo 1	demo1@example.com	$2b$12$demodemodemodemodemodemodemodemodemodemodemodemodemod	f
2	demo2	Usuario Demo 2	demo2@example.com	$2b$12$demodemodemodemodemodemodemodemodemodemodemodemodemod	f
3	demo3	Usuario Demo 3	demo3@example.com	$2b$12$demodemodemodemodemodemodemodemodemodemodemodemodemod	f
4	demo4	Usuario Demo 4	demo4@example.com	$2b$12$demodemodemodemodemodemodemodemodemodemodemodemodemod	f
5	demo5	Usuario Demo 5	demo5@example.com	$2b$12$demodemodemodemodemodemodemodemodemodemodemodemodemod	f
\.


--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_roles (id_user, rol_code, assigned_by_id, expires_at, created_at) FROM stdin;
1	ADMIN	\N	\N	2026-09-17 13:07:29.878865
2	CLIENT	\N	\N	2026-09-17 13:07:30.244941
3	STOCK	\N	\N	2026-09-17 13:07:30.586944
4	PEDIDOS	\N	\N	2026-09-17 13:07:31.00832
5	COCINA	\N	\N	2026-09-17 13:07:31.443153
\.


--
-- Name: category_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.category_id_seq', 7, true);


--
-- Name: detalle_pedido_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.detalle_pedido_id_seq', 194, true);


--
-- Name: direccion_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.direccion_id_seq', 1, true);


--
-- Name: estado_pedido_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.estado_pedido_id_seq', 6, true);


--
-- Name: forma_pago_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.forma_pago_id_seq', 4, true);


--
-- Name: historial_estado_pedido_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.historial_estado_pedido_id_seq', 480, true);


--
-- Name: images_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.images_id_seq', 1, false);


--
-- Name: ingredient_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.ingredient_id_seq', 14, true);


--
-- Name: pagos_mp_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pagos_mp_id_seq', 1, false);


--
-- Name: pedido_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.pedido_id_seq', 99, true);


--
-- Name: product_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.product_id_seq', 9, true);


--
-- Name: transicion_estado_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.transicion_estado_id_seq', 14, true);


--
-- Name: user_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.user_id_seq', 5, true);


--
-- Name: category category_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category
    ADD CONSTRAINT category_pkey PRIMARY KEY (id);


--
-- Name: detalle_pedido detalle_pedido_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detalle_pedido
    ADD CONSTRAINT detalle_pedido_pkey PRIMARY KEY (id);


--
-- Name: direccion direccion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.direccion
    ADD CONSTRAINT direccion_pkey PRIMARY KEY (id);


--
-- Name: estado_pedido estado_pedido_codigo_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estado_pedido
    ADD CONSTRAINT estado_pedido_codigo_key UNIQUE (codigo);


--
-- Name: estado_pedido estado_pedido_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.estado_pedido
    ADD CONSTRAINT estado_pedido_pkey PRIMARY KEY (id);


--
-- Name: forma_pago forma_pago_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forma_pago
    ADD CONSTRAINT forma_pago_pkey PRIMARY KEY (id);


--
-- Name: historial_estado_pedido historial_estado_pedido_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historial_estado_pedido
    ADD CONSTRAINT historial_estado_pedido_pkey PRIMARY KEY (id);


--
-- Name: images images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.images
    ADD CONSTRAINT images_pkey PRIMARY KEY (id);


--
-- Name: images images_public_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.images
    ADD CONSTRAINT images_public_id_key UNIQUE (public_id);


--
-- Name: ingredient ingredient_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ingredient
    ADD CONSTRAINT ingredient_pkey PRIMARY KEY (id);


--
-- Name: pagos_mp pagos_mp_external_reference_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_mp
    ADD CONSTRAINT pagos_mp_external_reference_key UNIQUE (external_reference);


--
-- Name: pagos_mp pagos_mp_idempotency_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_mp
    ADD CONSTRAINT pagos_mp_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: pagos_mp pagos_mp_mp_payment_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_mp
    ADD CONSTRAINT pagos_mp_mp_payment_id_key UNIQUE (mp_payment_id);


--
-- Name: pagos_mp pagos_mp_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_mp
    ADD CONSTRAINT pagos_mp_pkey PRIMARY KEY (id);


--
-- Name: pedido pedido_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedido
    ADD CONSTRAINT pedido_pkey PRIMARY KEY (id);


--
-- Name: product_category product_category_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_category
    ADD CONSTRAINT product_category_pkey PRIMARY KEY (product_id, category_id);


--
-- Name: product_ingredient product_ingredient_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_ingredient
    ADD CONSTRAINT product_ingredient_pkey PRIMARY KEY (product_id, ingredient_id);


--
-- Name: product product_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product
    ADD CONSTRAINT product_pkey PRIMARY KEY (id);


--
-- Name: roles roles_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_name_key UNIQUE (name);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (code);


--
-- Name: transicion_estado transicion_estado_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transicion_estado
    ADD CONSTRAINT transicion_estado_pkey PRIMARY KEY (id);


--
-- Name: transicion_estado uq_transicion_origen_destino_rol; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transicion_estado
    ADD CONSTRAINT uq_transicion_origen_destino_rol UNIQUE (estado_origen_id, estado_destino_id, rol_code);


--
-- Name: user user_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id_user, rol_code);


--
-- Name: ix_category_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_category_name ON public.category USING btree (name);


--
-- Name: ix_ingredient_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_ingredient_name ON public.ingredient USING btree (name);


--
-- Name: ix_user_email; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_user_email ON public."user" USING btree (email);


--
-- Name: ix_user_username; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_user_username ON public."user" USING btree (username);


--
-- Name: category category_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.category
    ADD CONSTRAINT category_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.category(id);


--
-- Name: detalle_pedido detalle_pedido_pedido_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detalle_pedido
    ADD CONSTRAINT detalle_pedido_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES public.pedido(id);


--
-- Name: detalle_pedido detalle_pedido_producto_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.detalle_pedido
    ADD CONSTRAINT detalle_pedido_producto_id_fkey FOREIGN KEY (producto_id) REFERENCES public.product(id);


--
-- Name: historial_estado_pedido historial_estado_pedido_estado_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historial_estado_pedido
    ADD CONSTRAINT historial_estado_pedido_estado_id_fkey FOREIGN KEY (estado_id) REFERENCES public.estado_pedido(id);


--
-- Name: historial_estado_pedido historial_estado_pedido_pedido_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.historial_estado_pedido
    ADD CONSTRAINT historial_estado_pedido_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES public.pedido(id);


--
-- Name: pagos_mp pagos_mp_pedido_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pagos_mp
    ADD CONSTRAINT pagos_mp_pedido_id_fkey FOREIGN KEY (pedido_id) REFERENCES public.pedido(id);


--
-- Name: pedido pedido_direccion_entrega_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedido
    ADD CONSTRAINT pedido_direccion_entrega_id_fkey FOREIGN KEY (direccion_entrega_id) REFERENCES public.direccion(id);


--
-- Name: pedido pedido_estado_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedido
    ADD CONSTRAINT pedido_estado_id_fkey FOREIGN KEY (estado_id) REFERENCES public.estado_pedido(id);


--
-- Name: pedido pedido_forma_pago_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pedido
    ADD CONSTRAINT pedido_forma_pago_id_fkey FOREIGN KEY (forma_pago_id) REFERENCES public.forma_pago(id);


--
-- Name: product_category product_category_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_category
    ADD CONSTRAINT product_category_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.category(id);


--
-- Name: product_category product_category_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_category
    ADD CONSTRAINT product_category_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.product(id);


--
-- Name: product_ingredient product_ingredient_ingredient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_ingredient
    ADD CONSTRAINT product_ingredient_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredient(id);


--
-- Name: product_ingredient product_ingredient_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.product_ingredient
    ADD CONSTRAINT product_ingredient_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.product(id);


--
-- Name: transicion_estado transicion_estado_estado_destino_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transicion_estado
    ADD CONSTRAINT transicion_estado_estado_destino_id_fkey FOREIGN KEY (estado_destino_id) REFERENCES public.estado_pedido(id);


--
-- Name: transicion_estado transicion_estado_estado_origen_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transicion_estado
    ADD CONSTRAINT transicion_estado_estado_origen_id_fkey FOREIGN KEY (estado_origen_id) REFERENCES public.estado_pedido(id);


--
-- Name: transicion_estado transicion_estado_rol_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transicion_estado
    ADD CONSTRAINT transicion_estado_rol_code_fkey FOREIGN KEY (rol_code) REFERENCES public.roles(code);


--
-- Name: user_roles user_roles_assigned_by_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_assigned_by_id_fkey FOREIGN KEY (assigned_by_id) REFERENCES public."user"(id);


--
-- Name: user_roles user_roles_id_user_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_id_user_fkey FOREIGN KEY (id_user) REFERENCES public."user"(id);


--
-- Name: user_roles user_roles_rol_code_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_rol_code_fkey FOREIGN KEY (rol_code) REFERENCES public.roles(code);


--
-- PostgreSQL database dump complete
--

\unrestrict fRoPiCGV4dOdAQR5Ml2SmV6r7cK8zN1fYrafSZFx3cYdGUQHYrRdgJkgrREWxbd

