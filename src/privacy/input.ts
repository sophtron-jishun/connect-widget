/* eslint-disable no-restricted-imports */
// This is the ONLY file that @kyper related inputs should be directly imported

import {
  TextInput,
  PasswordInput,
  Radio,
  Switch,
  InputGroup,
  PASSWORD_VALIDATIONS,
} from '@kyper/input'
import TextField from '@mui/material/TextField'
import { Select } from '@kyper/select'
import { SelectionBox } from '@kyper/selectionbox'
import { TextArea } from '@kyper/textarea'
import { UserFeedback } from '@kyper/userfeedback'
import { withProtection } from 'src/privacy/withProtection'

/*
  Add security to Kyper Inputs by wrapping them in a Higher Order Component that
  handles security, and then re-export the same-named component for consumers
  
  Example code snippets:

  const Protected<inputname> = withProtection(<inputname>)
  ...
  export { Protected<inputname> as <inputname> }
*/

const ProtectedTextField = withProtection(TextField)
const ProtectedTextInput = withProtection(TextInput)
const ProtectedPasswordInput = withProtection(PasswordInput)
const ProtectedRadio = withProtection(Radio)
const ProtectedSwitch = withProtection(Switch)
const ProtectedInputGroup = withProtection(InputGroup)
const ProtectedSelect = withProtection(Select)
const ProtectedSelectionBox = withProtection(SelectionBox)
const ProtectedTextArea = withProtection(TextArea)
const ProtectedUserFeedback = withProtection(UserFeedback)

export {
  ProtectedTextInput as TextInput,
  ProtectedTextField as TextField,
  ProtectedPasswordInput as PasswordInput,
  ProtectedRadio as Radio,
  ProtectedSwitch as Switch,
  ProtectedInputGroup as InputGroup,
  ProtectedSelect as Select,
  ProtectedSelectionBox as SelectionBox,
  ProtectedTextArea as TextArea,
  ProtectedUserFeedback as UserFeedback,
  PASSWORD_VALIDATIONS as PasswordValidations,
}
