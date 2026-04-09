import { Navigate } from "react-router-dom";

/**
 * @deprecated Ordens de Venda have been renamed to Pedidos.
 * This component redirects to the Pedidos page for backward compatibility.
 * The underlying data is still stored in the ordens_venda table.
 */
const OrdensVenda = () => <Navigate to="/pedidos" replace />;

export default OrdensVenda;
