/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react'

import { Text } from '@kyper/mui'
import { useTokens } from '@kyper/tokenprovider'
import { Button } from '@mui/material'

interface ActionableUtilityRowProps {
  icon: React.ReactNode
  onClick: () => void
  role?: string
  showHorizontalLine?: boolean
  text: string
  textStyles?: object
}

export const ActionableUtilityRow: React.FC<ActionableUtilityRowProps> = (props) => {
  const { text, textStyles, onClick, icon, role = 'button', showHorizontalLine = true } = props

  const tokens = useTokens()
  const styles = getStyles(tokens)

  return (
    <div style={styles.container}>
      <Button
        data-test="actionable-utility-row"
        onClick={onClick}
        role={role}
        size="medium"
        style={styles.button}
        variant="text"
      >
        <div style={styles.content}>
          <Text
            color="secondary"
            component="p"
            style={textStyles ?? {}}
            truncate={false}
            variant="Paragraph"
          >
            {text}
          </Text>

          {icon}
        </div>
      </Button>

      {showHorizontalLine && <hr style={styles.hr} />}
    </div>
  )
}

const getStyles = (tokens: any) => {
  return {
    container: {
      marginLeft: `-${tokens.Spacing.Small}px`,
      marginRight: `-${tokens.Spacing.Small}px`,
    },
    content: {
      display: 'flex',
      width: '100%',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    button: {
      width: '100%',
      paddingLeft: tokens.Spacing.Small,
      paddingRight: tokens.Spacing.Small,
      borderRadius: tokens.BorderRadius.CardRounded,
    },
    hr: {
      margin: `0px ${tokens.Spacing.Small}px`,
      backgroundColor: tokens.BackgroundColor.HrLight,
      borderTop: 'unset',
    },
  }
}
