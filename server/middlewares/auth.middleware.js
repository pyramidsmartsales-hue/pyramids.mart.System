// basic placeholder: in production plug real auth strategy (JWT/session)
export default function authMiddleware(req, res, next) {
  // for now, pass-through
  next();
}
