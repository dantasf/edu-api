const express = require('express');
const { expressjwt: jwt } = require('express-jwt');
const jsonwebtoken = require('jsonwebtoken');
const { createLogger, format, transports } = require('winston');
const client = require('prom-client');

const app = express();
app.use(express.json());

// Chave secreta para assinatura – em produção, use variável de ambiente
const SECRET_KEY = process.env.SECRET_KEY || 'edu_learn_secret';

// Logger global
const logger = createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.json()
  ),
  transports: [
    new transports.Console()
  ],
});

// Métricas padrão do Prometheus
client.collectDefaultMetrics();

// Histograma de latência das requisições HTTP
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duracao das requisicoes HTTP em segundos',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2.5, 5]
});

// Middleware para medir latência
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const delta = (Date.now() - start) / 1000;

    httpRequestDuration
      .labels(req.method, req.path, res.statusCode)
      .observe(delta);
  });

  next();
});

// Endpoint público para emissão de token
app.get('/token', (req, res) => {
  const user = req.query.user || 'guest';
  const role = req.query.role || 'student';
  const payload = { sub: user, role };

  const token = jsonwebtoken.sign(payload, SECRET_KEY, {
    expiresIn: '1h'
  });

  logger.info('Token emitido', {
    user,
    role,
    timestamp: new Date().toISOString()
  });

  res.json({ token });
});

// Endpoint público de métricas Prometheus
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

// Middleware JWT
app.use(
  jwt({
    secret: SECRET_KEY,
    algorithms: ['HS256']
  }).unless({
    path: ['/token', '/metrics']
  })
);

// Endpoint protegido
app.get('/users', (req, res) => {
  logger.info('Acesso a /users', {
    user: req.auth.sub,
    role: req.auth.role
  });

  res.json([
    {
      id: 1,
      name: 'Alice Silva',
      role: 'professora',
      email: 'alice@edulearn.com',
      dateOfBirth: '12/04/1998',
      cpf: '12345678901',
      department: 'Ciência da Computação',
      salary: 'R$ 4.500,00'
    },
    {
      id: 2,
      name: 'Lucas Reinaldo',
      role: 'professor',
      email: 'lucas@edulearn.com',
      dateOfBirth: '23/11/1985',
      cpf: '98765432100',
      department: 'Matemática',
      salary: 'R$ 6.200,00'
    },
    {
      id: 3,
      name: 'Carla Oliveira',
      role: 'professora',
      email: 'carla@edulearn.com',
      dateOfBirth: '30/07/2000',
      cpf: '13579246800',
      department: 'Química',
      salary: 'R$ 5.000,00'
    }
  ]);
});

// Tratamento de erros de autenticação JWT
app.use((err, req, res, next) => {
  if (err.name === 'UnauthorizedError') {
    logger.error('Falha de autenticação', {
      message: err.message,
      path: req.path,
      timestamp: new Date().toISOString()
    });

    return res.status(401).json({
      message: 'Token inválido ou ausente'
    });
  }

  next(err);
});

// Inicialização do servidor
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`EduLearn User Service rodando na porta ${PORT}`);
});

app.get('/calc', (req, res) => {
  const expr = req.query.expr || '2+2';

  // Insecure eval
  const result = eval(expr);

  res.json({ result });
});