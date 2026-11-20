import { Route, Routes } from 'react-router-dom'
import { AdminGate } from './AdminGate'
import { AdminLayout } from './AdminLayout'
import Painel from './Painel'
import Agenda from './Agenda'
import Clientes, { ClienteDetalhe } from './Clientes'
import ServicosAdmin from './Servicos'
import Horarios from './Horarios'
import GaleriaAdmin from './GaleriaAdmin'
import Conteudo from './Conteudo'

export default function AdminRoutes() {
  return (
    <AdminGate>
      <Routes>
        <Route element={<AdminLayout />}>
          <Route index element={<Painel />} />
          <Route path="agenda" element={<Agenda />} />
          <Route path="clientes" element={<Clientes />} />
          <Route path="clientes/:id" element={<ClienteDetalhe />} />
          <Route path="servicos" element={<ServicosAdmin />} />
          <Route path="horarios" element={<Horarios />} />
          <Route path="galeria" element={<GaleriaAdmin />} />
          <Route path="conteudo" element={<Conteudo />} />
        </Route>
      </Routes>
    </AdminGate>
  )
}
